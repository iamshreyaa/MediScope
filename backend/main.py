import re
import shutil
import uuid
from pathlib import Path
from typing import List

from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from datetime import datetime
from backend.database import get_db, Base, engine
from backend.models import Admin, Doctor, Patient, Condition, Report, ChatMessage, PatientQuestion, CheckIn
from backend.schemas import (
    AdminOut,
    AssignDoctor,
    ChatRequest,
    ChatMessageOut,
    CheckInCreate,
    CheckInOut,
    ConditionCreate,
    ConditionOut,
    DoctorCreate,
    DoctorOut,
    ForwardDecision,
    PatientCreate,
    PatientOut,
    PatientUpdate,
    QuestionAnswer,
    QuestionOut,
    ReportOut,
    ReportUpdate,
)
from backend.auth import CurrentUser, get_current_user, require_admin, require_doctor, require_patient
from backend.cache import rate_limit
from backend.firebase import auth_client
from backend.gemini_client import chat_with_gemini, sort_dictation

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = Path(__file__).parent / "uploads"

# Per-user limits on the endpoints that call Gemini, to protect the API quota
CHAT_MESSAGES_PER_MINUTE = 20
DICTATIONS_PER_MINUTE = 6

# Largest voice recording accepted for dictation (a few minutes of speech)
MAX_DICTATION_BYTES = 15 * 1024 * 1024

# How many earlier messages the chatbot gets to see as conversation memory
CHAT_HISTORY_LIMIT = 12

# Typed replies to "do you want me to send this to your doctor?". Only short messages made up
# entirely of these words count, so "ok, what about my diet?" is treated as a new question.
YES_WORDS = {"yes", "yeah", "yep", "yup", "sure", "ok", "okay", "please", "send", "go", "ahead"}
NO_WORDS = {"no", "nope", "nah", "don't", "dont", "not", "never"}
FILLER_WORDS = {"it", "do", "that", "this", "to", "my", "the", "doctor", "question", "thanks", "thank", "you", "now", "need"}


def typed_forward_decision(message: str):
    """Return True (send), False (don't send) or None (not a yes/no reply)."""
    words = re.findall(r"[a-z']+", message.lower())
    if not words or len(words) > 6:
        return None
    if any(word in NO_WORDS for word in words):
        return False if all(word in NO_WORDS | FILLER_WORDS | {"send"} for word in words) else None
    if words[0] in YES_WORDS and all(word in YES_WORDS | FILLER_WORDS for word in words):
        return True
    return None


def is_same_question(a: str, b: str) -> bool:
    """True when two questions use nearly the same words, so the doctor isn't sent a repeat."""
    words_a = set(re.findall(r"[a-z0-9']+", (a or "").lower()))
    words_b = set(re.findall(r"[a-z0-9']+", (b or "").lower()))
    if not words_a or not words_b:
        return False
    return len(words_a & words_b) / len(words_a | words_b) >= 0.75


def apply_forward_decision(message: ChatMessage, send: bool, db: Session) -> None:
    """Record the patient's choice for a question the bot offered to send to the doctor."""
    if send:
        db.add(PatientQuestion(patient_id=message.patient_id, question=message.proposed_question))
        message.flag = "forwarded"
    else:
        message.flag = "declined"


def serialize_user(user: CurrentUser) -> dict:
    schema = {"admin": AdminOut, "doctor": DoctorOut, "patient": PatientOut}[user.role]
    data = schema.model_validate(user.profile).model_dump(exclude={"conditions", "reports", "questions", "checkins"})
    return {**data, "uid": user.uid, "role": user.role}


def get_accessible_patient(patient_id: str, user: CurrentUser, db: Session) -> Patient:
    """Return the patient if the caller is that patient or the doctor who manages them."""
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if user.role == "patient" and user.uid == patient.id:
        return patient
    if user.role == "doctor" and patient.doctor_id == user.uid:
        return patient
    raise HTTPException(status_code=403, detail="Not allowed to access this patient")


def get_own_patient(patient_id: str, doctor: CurrentUser, db: Session) -> Patient:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != doctor.uid:
        raise HTTPException(status_code=403, detail="Not allowed to access this patient")
    return patient


# ----------------- Current user -----------------
# Nobody signs themselves up: admins create doctors, and doctors create patients.
@app.get("/me")
async def get_me(user: CurrentUser = Depends(get_current_user)):
    return serialize_user(user)


# ----------------- Admin: manage doctors -----------------
def doctor_row(doctor: Doctor) -> dict:
    return {**DoctorOut.model_validate(doctor).model_dump(), "patient_count": len(doctor.patients)}


@app.get("/admin/overview")
async def admin_overview(admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Doctors with their patient counts, plus patients who have no doctor.
    Admins see names and emails only, never medical notes or chats."""
    doctors = db.query(Doctor).order_by(Doctor.created_at.asc()).all()
    unassigned = db.query(Patient).filter(Patient.doctor_id.is_(None)).order_by(Patient.created_at.asc()).all()
    return {
        "doctors": [doctor_row(d) for d in doctors],
        "unassigned_patients": [{"id": p.id, "name": p.name, "email": p.email} for p in unassigned],
        "patient_count": db.query(Patient).count(),
    }


@app.post("/admin/doctors")
async def add_doctor(doctor: DoctorCreate, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Create the doctor's Firebase login and their profile in Postgres."""
    try:
        fb_user = auth_client.create_user(email=doctor.email, password=doctor.password, display_name=doctor.name)
    except auth_client.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        record = Doctor(
            id=fb_user.uid,
            email=doctor.email,
            name=doctor.name,
            specialization=doctor.specialization or None,
            license_number=doctor.license_number or None,
            hospital_name=doctor.hospital_name or None,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        auth_client.delete_user(fb_user.uid)
        raise
    return doctor_row(record)


@app.delete("/admin/doctors/{doctor_id}")
async def remove_doctor(doctor_id: str, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    """Remove a doctor and their login. Their patients and notes are kept; the patients
    become unassigned until an admin gives them to another doctor."""
    doctor = db.get(Doctor, doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    unassigned = db.query(Patient).filter(Patient.doctor_id == doctor_id).update({Patient.doctor_id: None})
    db.query(Condition).filter(Condition.doctor_id == doctor_id).update({Condition.doctor_id: None})
    db.query(Report).filter(Report.doctor_id == doctor_id).update({Report.doctor_id: None})
    db.delete(doctor)
    db.commit()

    try:
        auth_client.delete_user(doctor_id)
    except auth_client.UserNotFoundError:
        pass
    return {"deleted": doctor_id, "patients_unassigned": unassigned}


@app.post("/admin/patients/{patient_id}/assign")
async def assign_patient(patient_id: str, body: AssignDoctor, admin: CurrentUser = Depends(require_admin), db: Session = Depends(get_db)):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not db.get(Doctor, body.doctor_id):
        raise HTTPException(status_code=404, detail="Doctor not found")
    patient.doctor_id = body.doctor_id
    db.commit()
    return {"id": patient.id, "doctor_id": patient.doctor_id}


# ----------------- Doctor: manage patients -----------------
@app.get("/doctor/patients", response_model=List[PatientOut])
async def list_my_patients(doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    return db.query(Patient).filter(Patient.doctor_id == doctor.uid).order_by(Patient.created_at.asc()).all()


@app.post("/doctor/patients", response_model=PatientOut)
async def add_patient(patient: PatientCreate, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    """Create the patient's Firebase login and their profile in Postgres."""
    try:
        fb_user = auth_client.create_user(email=patient.email, password=patient.password, display_name=patient.name)
    except auth_client.EmailAlreadyExistsError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        record = Patient(
            id=fb_user.uid,
            doctor_id=doctor.uid,
            email=patient.email,
            name=patient.name,
            age=patient.age,
            gender=patient.gender or None,
            medical_history=patient.medical_history or "",
        )
        if patient.condition:
            record.conditions.append(Condition(doctor_id=doctor.uid, **patient.condition.model_dump()))
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        auth_client.delete_user(fb_user.uid)
        raise
    return record


@app.delete("/patients/{patient_id}")
async def delete_patient(patient_id: str, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    patient = get_own_patient(patient_id, doctor, db)

    db.query(ChatMessage).filter(ChatMessage.patient_id == patient_id).delete()
    db.delete(patient)
    db.commit()
    shutil.rmtree(UPLOAD_DIR / patient_id, ignore_errors=True)

    # Remove the login too, otherwise the email can never be re-used
    try:
        auth_client.delete_user(patient_id)
    except auth_client.UserNotFoundError:
        pass
    return {"deleted": patient_id}


# ----------------- Patient details -----------------
@app.get("/patients/{patient_id}", response_model=PatientOut)
async def get_patient(patient_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_accessible_patient(patient_id, user, db)


@app.put("/patients/{patient_id}", response_model=PatientOut)
async def update_patient(patient_id: str, changes: PatientUpdate, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    """Doctor corrects a patient's profile. The email is their login, so it is not editable here."""
    patient = get_own_patient(patient_id, doctor, db)
    patient.name = changes.name.strip()
    patient.age = changes.age
    patient.gender = changes.gender or None
    patient.medical_history = (changes.medical_history or "").strip()
    db.commit()
    db.refresh(patient)
    return patient


#Add condition
@app.post("/patients/{patient_id}/conditions", response_model=ConditionOut)
async def add_condition(patient_id: str, condition: ConditionCreate, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    get_own_patient(patient_id, doctor, db)
    cond = Condition(patient_id=patient_id, doctor_id=doctor.uid, **condition.model_dump())
    db.add(cond)
    db.commit()
    db.refresh(cond)
    return cond


@app.put("/conditions/{condition_id}", response_model=ConditionOut)
async def update_condition(condition_id: int, changes: ConditionCreate, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    cond = db.get(Condition, condition_id)
    if not cond:
        raise HTTPException(status_code=404, detail="Condition not found")
    get_own_patient(cond.patient_id, doctor, db)
    for field, value in changes.model_dump().items():
        setattr(cond, field, value)
    db.commit()
    db.refresh(cond)
    return cond


@app.delete("/conditions/{condition_id}")
async def delete_condition(condition_id: int, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    cond = db.get(Condition, condition_id)
    if not cond:
        raise HTTPException(status_code=404, detail="Condition not found")
    get_own_patient(cond.patient_id, doctor, db)
    db.delete(cond)
    db.commit()
    return {"deleted": condition_id}


#Upload report
@app.post("/patients/{patient_id}/reports", response_model=ReportOut)
async def upload_report(
    patient_id: str,
    report_name: str = Form(...),
    report_type: str = Form(...),
    file: UploadFile = File(...),
    doctor: CurrentUser = Depends(require_doctor),
    db: Session = Depends(get_db)
):
    get_own_patient(patient_id, doctor, db)

    # Store the file on disk under a generated name; Postgres keeps the metadata
    suffix = Path(file.filename or "").suffix
    relative_path = Path(patient_id) / f"{uuid.uuid4().hex}{suffix}"
    destination = UPLOAD_DIR / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    report = Report(
        patient_id=patient_id,
        doctor_id=doctor.uid,
        report_name=report_name,
        report_type=report_type,
        file_path=str(relative_path),
        upload_date=datetime.utcnow()
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


def get_own_report(report_id: int, doctor: CurrentUser, db: Session) -> Report:
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    get_own_patient(report.patient_id, doctor, db)
    return report


@app.put("/reports/{report_id}", response_model=ReportOut)
async def rename_report(report_id: int, changes: ReportUpdate, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    report = get_own_report(report_id, doctor, db)
    name = changes.report_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="The report needs a name")
    report.report_name = name
    db.commit()
    db.refresh(report)
    return report


@app.delete("/reports/{report_id}")
async def delete_report(report_id: int, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    """Remove a report and its uploaded file."""
    report = get_own_report(report_id, doctor, db)
    file_path = report.file_path
    db.delete(report)
    db.commit()
    if file_path:
        (UPLOAD_DIR / file_path).unlink(missing_ok=True)
    return {"deleted": report_id}


@app.get("/reports/{report_id}/file")
async def download_report(report_id: int, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    get_accessible_patient(report.patient_id, user, db)

    path = UPLOAD_DIR / (report.file_path or "")
    if not report.file_path or not path.is_file():
        raise HTTPException(status_code=404, detail="Report file not found")
    return FileResponse(path, media_type=report.report_type or "application/octet-stream", filename=report.report_name)


#Chat endpoint
@app.post("/chat")
async def chat(
    request: ChatRequest,
    user: CurrentUser = Depends(require_patient),
    _: None = Depends(rate_limit("chat", CHAT_MESSAGES_PER_MINUTE)),
    db: Session = Depends(get_db),
):
    """
    Chat endpoint that generates the AI response and saves both
    messages to Postgres. Questions the bot cannot answer and urgent
    symptoms are passed on to the doctor.
    """
    patient = user.profile
    patient_context = PatientOut.model_validate(patient).model_dump()

    recent = (
        db.query(ChatMessage)
        .filter(ChatMessage.patient_id == patient.id)
        .order_by(ChatMessage.timestamp.desc(), ChatMessage.id.desc())
        .limit(CHAT_HISTORY_LIMIT)
        .all()
    )
    history = [{"from": m.message_from, "content": m.message_content} for m in reversed(recent)]

    db.add(ChatMessage(
        patient_id=patient.id,
        message_from="patient",
        message_content=request.message,
        timestamp=datetime.utcnow()
    ))
    db.commit()

    # The patient answered the bot's "send this to your doctor?" by typing instead of using the buttons
    last_bot = next((m for m in recent if m.message_from == "bot"), None)
    if last_bot and last_bot.flag in ("ask_forward", "already_sent"):
        send = typed_forward_decision(request.message)
        if send is not None:
            if last_bot.flag == "already_sent":
                send = False
                reply_text = "That question is already with your doctor, so there is nothing more to send. Their reply will appear under Questions for Your Doctor in the My Health Info tab."
            else:
                apply_forward_decision(last_bot, send, db)
                reply_text = (
                    "Done, I have sent your question to your doctor. Their reply will appear under Questions for Your Doctor in the My Health Info tab."
                    if send else
                    "Okay, I have not sent it. Let me know if you change your mind."
                )
            db.add(ChatMessage(
                patient_id=patient.id,
                message_from="bot",
                message_content=reply_text,
                timestamp=datetime.utcnow()
            ))
            db.commit()
            return {"message": reply_text, "urgent": False, "forwarded": send, "ask_forward": False}

    urgent = False
    question_for_doctor = None
    sources = None
    try:
        result = chat_with_gemini(patient_context, request.message, history)
        reply_text = result["reply"]
        urgent = result["urgent"]
        question_for_doctor = result["question_for_doctor"]
        sources = result["sources"] or None
    except Exception as e:
        reply_text = "AI response unavailable. Please try again later."
        print(f"Gemini error: {e}")
        import traceback
        traceback.print_exc()

    # Urgent symptoms alert the doctor straight away; ordinary questions are only
    # sent once the patient agrees
    ask_forward = bool(question_for_doctor) and not urgent
    already_sent = ask_forward and any(
        not q.resolved and is_same_question(q.question, question_for_doctor) for q in patient.questions
    )
    ask_forward = ask_forward and not already_sent
    if urgent:
        db.add(PatientQuestion(
            patient_id=patient.id,
            question=question_for_doctor or request.message,
            urgent=True,
        ))

    db.add(ChatMessage(
        patient_id=patient.id,
        message_from="bot",
        message_content=reply_text,
        flag="urgent" if urgent else "ask_forward" if ask_forward else "already_sent" if already_sent else None,
        proposed_question=question_for_doctor if ask_forward else None,
        sources=sources,
        timestamp=datetime.utcnow()
    ))
    db.commit()

    return {"message": reply_text, "urgent": urgent, "forwarded": urgent, "ask_forward": ask_forward}


@app.post("/chat-messages/{message_id}/forward", response_model=ChatMessageOut)
async def decide_forward(message_id: int, decision: ForwardDecision, user: CurrentUser = Depends(require_patient), db: Session = Depends(get_db)):
    """Patient says whether the question the bot proposed should be sent to their doctor."""
    message = db.get(ChatMessage, message_id)
    if not message or message.patient_id != user.uid:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.flag != "ask_forward":
        raise HTTPException(status_code=409, detail="This question has already been handled")
    apply_forward_decision(message, decision.send, db)
    db.commit()
    db.refresh(message)
    return message


#Get chat history
@app.get("/patients/{patient_id}/chat-history", response_model=List[ChatMessageOut])
async def get_chat_history(patient_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    get_accessible_patient(patient_id, user, db)
    chats = db.query(ChatMessage).filter(ChatMessage.patient_id == patient_id).order_by(ChatMessage.timestamp.asc(), ChatMessage.id.asc()).all()
    return chats


# ----------------- Questions passed on to the doctor -----------------
@app.post("/questions/{question_id}/answer", response_model=QuestionOut)
async def answer_question(question_id: int, body: QuestionAnswer, doctor: CurrentUser = Depends(require_doctor), db: Session = Depends(get_db)):
    """Doctor replies to a patient's question (or just marks it resolved)."""
    question = db.get(PatientQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    get_own_patient(question.patient_id, doctor, db)

    answer = (body.answer or "").strip()
    if answer:
        question.answer = answer
        question.answered_at = datetime.utcnow()
    question.resolved = True
    db.commit()
    db.refresh(question)
    return question


# ----------------- Weekly check-ins -----------------
@app.post("/checkins", response_model=CheckInOut)
async def submit_checkin(checkin: CheckInCreate, user: CurrentUser = Depends(require_patient), db: Session = Depends(get_db)):
    record = CheckIn(patient_id=user.uid, feeling=checkin.feeling, note=(checkin.note or "").strip() or None)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


# ----------------- Voice dictation of notes -----------------
@app.post("/dictation")
async def dictate_notes(
    audio: UploadFile = File(...),
    doctor: CurrentUser = Depends(require_doctor),
    _: None = Depends(rate_limit("dictation", DICTATIONS_PER_MINUTE)),
):
    """Turn the doctor's spoken notes into text sorted by field. Nothing is saved here;
    the doctor reviews the filled-in form and saves it as usual."""
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="The recording was empty")
    if len(data) > MAX_DICTATION_BYTES:
        raise HTTPException(status_code=413, detail="The recording is too long. Please keep it under a few minutes.")

    try:
        notes = sort_dictation(data, audio.content_type or "audio/wav")
    except Exception as e:
        print(f"Dictation error: {e}")
        raise HTTPException(status_code=502, detail="Could not process the recording. Please try again or type the notes.")

    if not notes["transcript"]:
        raise HTTPException(status_code=422, detail="No speech was heard in the recording. Please try again.")
    return notes

