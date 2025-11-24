# from dotenv import load_dotenv
# import os

# dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
# load_dotenv(dotenv_path)

# cred_path = os.getenv("FIREBASE_CREDENTIALS")
# bucket_name = os.getenv("FIREBASE_BUCKET")

# print("cred_path:", cred_path)
# print("bucket_name:", bucket_name)

# if not cred_path or not bucket_name:
#     raise ValueError("FIREBASE_CREDENTIALS or FIREBASE_BUCKET environment variable not set.")

# def upload_file(local_file_path, destination_blob_name):
#     """
#     Uploads a file to Firebase Storage.
    
#     Args:
#         local_file_path (str): Path to the local file.
#         destination_blob_name (str): Name of the file in the bucket.
#     """
#     blob = bucket_name.blob(destination_blob_name)
#     blob.upload_from_filename(local_file_path)
#     print(f"File {local_file_path} uploaded to {destination_blob_name}.")

import os
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore, auth, storage

# Load .env
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

# Read env variables
cred_path = os.getenv("FIREBASE_CREDENTIALS")
bucket_name = os.getenv("FIREBASE_BUCKET")

print("cred_path:", cred_path)
print("bucket_name:", bucket_name)

if not cred_path or not bucket_name:
    raise ValueError("FIREBASE_CREDENTIALS or FIREBASE_BUCKET not set")

# Initialize Firebase Admin only once
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {
        "storageBucket": bucket_name
    })

# Firestore client
db = firestore.client()

# Auth client
auth_client = auth

# Storage bucket
bucket = storage.bucket()

def upload_file(local_file_path, destination_blob_name):
    """Upload a file to Firebase Storage."""
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(local_file_path)
    print(f"File {local_file_path} uploaded to {destination_blob_name}.")
