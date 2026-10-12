from dataclasses import dataclass
from typing import Optional, Union

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.firebase import auth_client
from backend.models import Admin, Doctor, Patient

bearer = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    uid: str
    role: str  # 'admin', 'doctor' or 'patient'
    profile: Union[Admin, Doctor, Patient]


def get_token_claims(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    """Verify the Firebase ID token sent by the frontend and return its claims."""
    if not creds:
        raise HTTPException(status_code=401, detail="Missing authentication token")
    try:
        return auth_client.verify_id_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired authentication token")


def get_current_user(claims: dict = Depends(get_token_claims), db: Session = Depends(get_db)) -> CurrentUser:
    """Look up the signed-in user's profile (and therefore role) in Postgres."""
    uid = claims["uid"]
    admin = db.get(Admin, uid)
    if admin:
        return CurrentUser(uid=uid, role="admin", profile=admin)
    doctor = db.get(Doctor, uid)
    if doctor:
        return CurrentUser(uid=uid, role="doctor", profile=doctor)
    patient = db.get(Patient, uid)
    if patient:
        return CurrentUser(uid=uid, role="patient", profile=patient)
    raise HTTPException(status_code=404, detail="User profile not found")


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admins only")
    return user


def require_doctor(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctors only")
    return user


def require_patient(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != "patient":
        raise HTTPException(status_code=403, detail="Patients only")
    return user
