#!/usr/bin/env python3
"""
Create an admin account. Admins are the only accounts not created inside the app,
so run this once to make the first one (and again for any further admins).

    venv/bin/python backend/create_admin.py admin@example.com "a-strong-password" "Admin Name"

If a login with that email already exists, it is reused and its password is left unchanged.
"""
import sys
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database import Base, SessionLocal, engine
from backend.firebase import auth_client
from backend.models import Admin, Doctor, Patient


def create_admin(email: str, password: str, name: str) -> str:
    Base.metadata.create_all(bind=engine)
    try:
        uid = auth_client.get_user_by_email(email).uid
        created = False
    except auth_client.UserNotFoundError:
        uid = auth_client.create_user(email=email, password=password, display_name=name).uid
        created = True

    db = SessionLocal()
    try:
        if db.get(Doctor, uid) or db.get(Patient, uid):
            raise SystemExit(f"{email} is already a doctor or patient. Use a different email for the admin.")
        db.merge(Admin(id=uid, email=email, name=name))
        db.commit()
    finally:
        db.close()

    print(f"Admin ready: {email} ({'new login created' if created else 'existing login reused, password unchanged'})")
    return uid


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    create_admin(*sys.argv[1:])
