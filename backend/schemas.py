# schemas.py
from pydantic import BaseModel, ConfigDict, PlainSerializer
from typing import Annotated, List, Literal, Optional
from datetime import datetime, timezone


def _as_utc(value: datetime) -> str:
    # Timestamps are stored as naive UTC; tag them so browsers don't read them as local time
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


UTCDatetime = Annotated[datetime, PlainSerializer(_as_utc, return_type=str)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ----------------- Admin -----------------
class AdminOut(ORMModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None


class DoctorCreate(BaseModel):
    name: str
    email: str
    password: str
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    hospital_name: Optional[str] = None


class AssignDoctor(BaseModel):
    doctor_id: str


# ----------------- Doctor -----------------
class DoctorOut(ORMModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    hospital_name: Optional[str] = None


# ----------------- Patient Condition -----------------
class ConditionCreate(BaseModel):
    diagnosis: str
    description: Optional[str] = None
    medication_instructions: Optional[str] = None
    follow_up_guidelines: Optional[str] = None
    lifestyle_recommendations: Optional[str] = None
    warning_symptoms: Optional[str] = None
    other_notes: Optional[str] = None


class ConditionOut(ConditionCreate, ORMModel):
    id: int
    patient_id: str
    doctor_id: Optional[str] = None


# ----------------- Patient Report -----------------
class ReportUpdate(BaseModel):
    report_name: str


class ReportOut(ORMModel):
    id: int
    patient_id: str
    doctor_id: Optional[str] = None
    report_name: Optional[str] = None
    report_type: Optional[str] = None
    upload_date: Optional[UTCDatetime] = None


# ----------------- Questions for the doctor -----------------
class QuestionOut(ORMModel):
    id: int
    patient_id: str
    question: str
    urgent: Optional[bool] = False
    answer: Optional[str] = None
    resolved: Optional[bool] = False
    created_at: Optional[UTCDatetime] = None
    answered_at: Optional[UTCDatetime] = None


class QuestionAnswer(BaseModel):
    answer: Optional[str] = None  # empty = just mark as resolved


# ----------------- Weekly check-ins -----------------
class CheckInCreate(BaseModel):
    feeling: Literal["better", "same", "worse"]
    note: Optional[str] = None


class CheckInOut(ORMModel):
    id: int
    patient_id: str
    feeling: str
    note: Optional[str] = None
    created_at: Optional[UTCDatetime] = None


# ----------------- Patient -----------------
class PatientCreate(BaseModel):
    name: str
    email: str
    password: str
    age: Optional[int] = None
    gender: Optional[str] = None
    medical_history: Optional[str] = None
    # The doctor's first notes for the patient, filled in on the add-patient form
    condition: Optional[ConditionCreate] = None


class PatientUpdate(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    medical_history: Optional[str] = None


class PatientOut(ORMModel):
    id: str
    doctor_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    medical_history: Optional[str] = None
    conditions: List[ConditionOut] = []
    reports: List[ReportOut] = []
    questions: List[QuestionOut] = []
    checkins: List[CheckInOut] = []


# ----------------- Chat History -----------------
class ChatMessageOut(ORMModel):
    id: int
    patient_id: str
    message_from: str  # 'patient' or 'bot'
    message_content: str
    flag: Optional[str] = None
    proposed_question: Optional[str] = None
    sources: Optional[List[dict]] = None
    timestamp: Optional[UTCDatetime] = None


class ChatRequest(BaseModel):
    message: str


class ForwardDecision(BaseModel):
    send: bool
