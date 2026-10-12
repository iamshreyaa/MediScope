#!/usr/bin/env python3
"""
One-off script: rebuild the Postgres tables to match backend/models.py and copy
the existing Firestore data (doctors, patients, chats) into them.

Firestore is only read, never modified. Safe to run more than once.

    venv/bin/python backend/migrate_firestore_to_postgres.py
"""
import sys
from collections import Counter
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from firebase_admin import firestore
from sqlalchemy import inspect, text

import backend.firebase  # noqa: F401  (initialises the Firebase app)
from backend.database import Base, SessionLocal, engine
from backend.models import ChatMessage, Doctor, Patient

# Tables left behind by earlier versions of the schema
LEGACY_TABLES = ["patient_conditions", "patient_reports", "conditions", "reports", "patients", "doctors"]


def rebuild_tables():
    """Drop outdated tables (only if they hold no rows) and create the current ones."""
    # Read the current shapes first and release that connection, so it can't block the drops
    with engine.connect() as conn:
        inspector = inspect(conn)
        columns = {
            table: {c["name"]: str(c["type"]) for c in inspector.get_columns(table)}
            for table in LEGACY_TABLES
            if inspector.has_table(table)
        }

    with engine.begin() as conn:
        conn.execute(text("SET lock_timeout = '10s'"))
        for table, cols in columns.items():
            is_current = table in ("doctors", "patients") and cols["id"].startswith("VARCHAR")
            is_current = is_current or (table in ("conditions", "reports") and "doctor_id" in cols)
            if is_current:
                continue
            rows = conn.execute(text(f'SELECT count(*) FROM "{table}"')).scalar()
            if rows:
                raise SystemExit(f"Table {table} has {rows} rows in an old format; not dropping it. Move the data first.")
            conn.execute(text(f'DROP TABLE "{table}" CASCADE'))
            print(f"dropped empty legacy table {table}")
    Base.metadata.create_all(bind=engine)


def copy_data():
    fs = firestore.client()
    db = SessionLocal()
    try:
        doctor_ids = set()
        for doc in fs.collection("doctors").stream():
            d = doc.to_dict() or {}
            doctor_ids.add(doc.id)
            db.merge(Doctor(
                id=doc.id,
                email=d.get("email"),
                name=d.get("name"),
                specialization=d.get("specialization"),
                license_number=d.get("license_number"),
                hospital_name=d.get("hospital_name"),
            ))
        db.flush()
        print(f"doctors copied: {len(doctor_ids)}")

        patients = 0
        chats = 0
        for doc in fs.collection("patients").stream():
            d = doc.to_dict() or {}
            doctor_id = d.get("doctorId")
            age = d.get("age")
            db.merge(Patient(
                id=doc.id,
                doctor_id=doctor_id if doctor_id in doctor_ids else None,
                email=d.get("email"),
                name=d.get("name"),
                age=age if isinstance(age, int) else None,
                gender=d.get("gender"),
                medical_history=d.get("medical_history"),
            ))
            patients += 1

            # The backend already saved most chat messages to Postgres; only add missing ones
            already = Counter(
                (m.message_from, m.message_content)
                for m in db.query(ChatMessage).filter(ChatMessage.patient_id == doc.id)
            )
            for chat in doc.reference.collection("chats").stream():
                c = chat.to_dict() or {}
                key = (c.get("message_from"), c.get("message_content"))
                if not key[1]:
                    continue
                if already[key] > 0:
                    already[key] -= 1
                    continue
                timestamp = c.get("timestamp")
                db.add(ChatMessage(
                    patient_id=doc.id,
                    message_from=key[0],
                    message_content=key[1],
                    timestamp=timestamp.replace(tzinfo=None) if timestamp else None,
                ))
                chats += 1
        db.commit()
        print(f"patients copied: {patients}")
        print(f"chat messages added: {chats}")
    finally:
        db.close()


if __name__ == "__main__":
    rebuild_tables()
    copy_data()
