# schemas.py
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# ----------------- Doctor -----------------
class DoctorBase(BaseModel):
    name: Optional[str]
    specialization: Optional[str]
    license_number: Optional[str]
    hospital_name: Optional[str]
    email: EmailStr

class DoctorCreate(DoctorBase):
    user_id: str

class DoctorOut(DoctorBase):
    id: int

    class Config:
        orm_mode = True

# ----------------- Patient -----------------
class PatientBase(BaseModel):
    name: Optional[str]
    email: Optional[EmailStr]
    age: Optional[int]
    gender: Optional[str]
    medical_history: Optional[str]

class PatientCreate(PatientBase):
    user_id: str
    doctor_id: int

class PatientOut(PatientBase):
    id: int
    doctor_id: int

    class Config:
        orm_mode = True

# ----------------- Patient Condition -----------------
class PatientConditionBase(BaseModel):
    diagnosis: str
    description: Optional[str]
    medication_instructions: Optional[str]
    follow_up_guidelines: Optional[str]
    lifestyle_recommendations: Optional[str]
    warning_symptoms: Optional[str]

class PatientConditionCreate(PatientConditionBase):
    patient_id: int

class PatientConditionOut(PatientConditionBase):
    id: int
    patient_id: int

    class Config:
        orm_mode = True

# ----------------- Patient Report -----------------
class PatientReportBase(BaseModel):
    report_name: str
    report_type: Optional[str]
    file_url: Optional[str]

class PatientReportCreate(PatientReportBase):
    patient_id: int
    doctor_id: int

class PatientReportOut(PatientReportBase):
    id: int
    patient_id: int
    doctor_id: int
    upload_date: datetime

    class Config:
        orm_mode = True

# ----------------- Chat History -----------------
class ChatMessageBase(BaseModel):
    message_from: str  # 'patient' or 'bot'
    message_content: str

class ChatMessageCreate(ChatMessageBase):
    patient_id: int

class ChatMessageOut(ChatMessageBase):
    id: int
    patient_id: int
    timestamp: datetime

    class Config:
        orm_mode = True


class ChatRequest(BaseModel):
    patient_id: str    # <-- Firebase UID as string
    message: str

class ConditionCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ReportCreate(BaseModel):
    report_name: str
    report_type: str
    file_url: str
