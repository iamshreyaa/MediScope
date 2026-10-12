from sqlalchemy import Boolean, Column, String, Integer, ForeignKey, Text, DateTime, JSON
from sqlalchemy.orm import relationship
from backend.database import Base
from datetime import datetime


class Admin(Base):
    """Runs the clinic's account: creates and removes doctors. Has no access to medical notes."""
    __tablename__ = "admins"
    id = Column(String, primary_key=True)  # Firebase UID
    email = Column(String, index=True)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class Doctor(Base):
    __tablename__ = "doctors"
    id = Column(String, primary_key=True)  # Firebase UID
    email = Column(String, index=True)
    name = Column(String)
    specialization = Column(String)
    license_number = Column(String)
    hospital_name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    patients = relationship("Patient", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True)  # Firebase UID
    doctor_id = Column(String, ForeignKey("doctors.id"), index=True, nullable=True)
    email = Column(String, index=True)
    name = Column(String)
    age = Column(Integer)
    gender = Column(String)
    medical_history = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("Doctor", back_populates="patients")
    conditions = relationship("Condition", cascade="all, delete-orphan", order_by="Condition.id")
    reports = relationship("Report", cascade="all, delete-orphan", order_by="Report.id")
    questions = relationship("PatientQuestion", cascade="all, delete-orphan", order_by="PatientQuestion.id.desc()")
    checkins = relationship("CheckIn", cascade="all, delete-orphan", order_by="CheckIn.id.desc()")
    chats = relationship(
        "ChatMessage",
        primaryjoin="Patient.id==foreign(ChatMessage.patient_id)",
        viewonly=True
    )


class Condition(Base):
    __tablename__ = "conditions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"), index=True)  # Firebase UID
    doctor_id = Column(String, ForeignKey("doctors.id"), nullable=True)
    diagnosis = Column(String)
    description = Column(Text)
    medication_instructions = Column(Text)
    follow_up_guidelines = Column(Text)
    lifestyle_recommendations = Column(Text)
    warning_symptoms = Column(Text)
    other_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"), index=True)  # Firebase UID
    doctor_id = Column(String, ForeignKey("doctors.id"), nullable=True)
    report_name = Column(String)
    report_type = Column(String)
    file_path = Column(String)  # relative to backend/uploads
    upload_date = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)  # Firebase UID
    message_from = Column(String)
    message_content = Column(String)
    # bot messages only: 'urgent', 'ask_forward' (waiting for the patient to say whether
    # to send proposed_question to the doctor), 'forwarded', 'declined' or 'already_sent'
    flag = Column(String)
    proposed_question = Column(Text)
    sources = Column(JSON)  # web pages the bot used: [{"title": ..., "url": ...}]
    timestamp = Column(DateTime, default=datetime.utcnow)


class PatientQuestion(Base):
    """A question the chatbot could not answer, or an urgent symptom, passed on to the doctor."""
    __tablename__ = "patient_questions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"), index=True)  # Firebase UID
    question = Column(Text)
    urgent = Column(Boolean, default=False)
    answer = Column(Text)  # the doctor's reply, if any
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    answered_at = Column(DateTime)


class CheckIn(Base):
    """The patient's weekly report of how they are doing."""
    __tablename__ = "checkins"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id"), index=True)  # Firebase UID
    feeling = Column(String)  # 'better', 'same' or 'worse'
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
