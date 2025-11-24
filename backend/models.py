from sqlalchemy import Column, String, Integer, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base
from datetime import datetime


class Patient(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True)
    chats = relationship(
        "ChatMessage",
        primaryjoin="Patient.id==foreign(ChatMessage.patient_id)",
        viewonly=True
    )

class Condition(Base):
    __tablename__ = "conditions"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)  # Firebase UID
    condition_name = Column(String)
    diagnosis_date = Column(DateTime)

class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)  # Firebase UID
    report_name = Column(String)
    report_type = Column(String)
    file_url = Column(String)
    upload_date = Column(DateTime)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)  # Firebase UID
    message_from = Column(String)
    message_content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

