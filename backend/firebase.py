import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, auth

# Load .env
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# Read env variables
cred_path = os.getenv("FIREBASE_CREDENTIALS")

if not cred_path:
    raise ValueError("FIREBASE_CREDENTIALS not set")

# Initialize Firebase Admin only once
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)

# Firebase is used for authentication only; all app data lives in Postgres
auth_client = auth
