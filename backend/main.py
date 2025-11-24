from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from datetime import datetime
from backend.database import get_db, Base, engine
from backend.models import Patient, Condition, Report, ChatMessage
from backend.schemas import ChatRequest, ConditionCreate, ReportCreate
from backend.firebase import upload_file
from backend.gemini_client import chat_with_gemini

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


#Chat endpoint
@app.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """
    Chat endpoint that generates AI response.
    Note: Frontend handles saving messages to Firestore.
    Backend only generates the AI response.
    """
    try:
        try:
            patient_msg = ChatMessage(
                patient_id=request.patient_id,
                message_from="patient",
                message_content=request.message,
                timestamp=datetime.utcnow()
            )
            db.add(patient_msg)
            db.commit()
        except Exception as db_error:
            
            print(f"Warning: Could not save to SQL database: {db_error}")


        try:
            reply_text = chat_with_gemini(request.patient_id, request.message)
        except Exception as e:
            reply_text = "AI response unavailable. Please try again later."
            print(f"Gemini error: {e}")
            import traceback
            traceback.print_exc()

        try:
            bot_msg = ChatMessage(
                patient_id=request.patient_id,
                message_from="bot",
                message_content=reply_text,
                timestamp=datetime.utcnow()
            )
            db.add(bot_msg)
            db.commit()
        except Exception as db_error:
            print(f"Warning: Could not save bot message to SQL database: {db_error}")

        return {"message": reply_text}

    except Exception as e:
        db.rollback()
        print(f"Error in /chat: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

#Add condition
@app.post("/patients/{patient_id}/conditions")
async def add_condition(patient_id: int, condition: ConditionCreate, db: Session = Depends(get_db)):
    cond = Condition(patient_id=patient_id, **condition.dict())
    db.add(cond)
    db.commit()
    db.refresh(cond)
    return cond

#Upload report
@app.post("/patients/{patient_id}/reports")
async def upload_report(
    patient_id: int,
    report_name: str = Form(...),
    report_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Upload to Firebase storage
    file_url = upload_file(file.file, f"{patient_id}/{file.filename}")

    report = Report(
        patient_id=patient_id,
        report_name=report_name,
        report_type=report_type,
        file_url=file_url,
        upload_date=datetime.utcnow()
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

#Get chat history
@app.get("/patients/{patient_id}/chat-history")
async def get_chat_history(patient_id: int, db: Session = Depends(get_db)):
    chats = db.query(ChatMessage).filter(ChatMessage.patient_id == patient_id).order_by(ChatMessage.timestamp.asc()).all()
    return chats

# Get patient summary
@app.get("/patients/{patient_id}/summary")
async def get_summary(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    conditions = db.query(Condition).filter(Condition.patient_id == patient_id).all()
    reports = db.query(Report).filter(Report.patient_id == patient_id).all()

    return {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "age": patient.age,
        "gender": patient.gender,
        "medical_history": patient.medical_history,
        "conditions": [cond.__dict__ for cond in conditions],
        "reports": [rep.__dict__ for rep in reports]
    }
