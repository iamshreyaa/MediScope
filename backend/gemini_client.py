# import os
# import tempfile
# from dotenv import load_dotenv
# from backend.firebase import db
# # Lazy import so the module doesn't fail if only GEMINI_API_KEY is set
# load_dotenv()

# _genai_client = None

# def get_genai_client():
#     global _genai_client
#     if _genai_client:
#         return _genai_client
#     key = os.getenv("GEMINI_API_KEY")
#     if not key:
#         return None
#     try:
#         from google import genai
#         _genai_client = genai.Client(api_key=key)
#         return _genai_client
#     except Exception:
#         _genai_client = None
#         return None


# def load_patient_profile(patient_id: str) -> dict:
#     """Load patient details from Firestore."""
#     doc_ref = db.collection("patients").document(patient_id)
#     doc = doc_ref.get()

#     if not doc.exists:
#         return {
#             "name": "",
#             "age": "",
#             "gender": "",
#             "medical_history": "",
#             "email": "",
#             "uid": patient_id,
#         }

#     return doc.to_dict()


# def chat_with_gemini(patient_id: str, prompt: str) -> str:
#     """Generate text using Gemini. Raises RuntimeError if client not configured."""
#     client = get_genai_client()
#     if not client:
#         raise RuntimeError("GEMINI_API_KEY not set or google-genai not installed")

#     model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
#     # call models.generate_content following the example: contents is list
#     response = client.models.generate_content(model=model, contents=[prompt])

#     # try to extract text safely
#     text = None
#     if hasattr(response, "text"):
#         text = response.text
#     else:
#         # try candidates or outputs
#         candidates = getattr(response, "candidates", None) or getattr(response, "outputs", None)
#         if candidates:
#             for c in candidates:
#                 if isinstance(c, str):
#                     text = c
#                     break
#                 t = getattr(c, "text", None) or (c.get("text") if isinstance(c, dict) else None)
#                 if t:
#                     text = t
#                     break

#     return text or ""


import os
import tempfile
from dotenv import load_dotenv
from backend.firebase import db
# Lazy import so the module doesn't fail if only GEMINI_API_KEY is set
load_dotenv()

_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client:
        return _genai_client
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    try:
        from google import genai
        _genai_client = genai.Client(api_key=key)
        return _genai_client
    except Exception:
        _genai_client = None
        return None


def load_patient_profile(patient_id: str) -> dict:
    """Load patient details from Firestore."""
    doc_ref = db.collection("patients").document(patient_id)
    doc = doc_ref.get()

    if not doc.exists:
        return {
            "name": "",
            "age": "",
            "gender": "",
            "medical_history": "",
            "email": "",
            "uid": patient_id,
        }

    return doc.to_dict()


def chat_with_gemini(patient_id: str, prompt: str) -> str:
    """Generate text using Gemini. Raises RuntimeError if client not configured."""
    client = get_genai_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY not set or google-genai not installed")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    # ------------------------------
    # ✅ ADDING ONLY REQUIRED LOGIC
    # ------------------------------
    patient = load_patient_profile(patient_id)

    patient_context = f"""
    Patient Profile:
    Name: {patient.get('name', 'N/A')}
    Age: {patient.get('age', 'N/A')}
    Gender: {patient.get('gender', 'N/A')}
    Medical History: {patient.get('medical_history', 'N/A')}
    Email: {patient.get('email', 'N/A')}
    """

    # prepend patient context
    prompt = patient_context + "\n\n" + prompt
    # ------------------------------

    # call models.generate_content following the example: contents is list
    response = client.models.generate_content(model=model, contents=[prompt])

    # try to extract text safely
    text = None
    if hasattr(response, "text"):
        text = response.text
    else:
        # try candidates or outputs
        candidates = getattr(response, "candidates", None) or getattr(response, "outputs", None)
        if candidates:
            for c in candidates:
                if isinstance(c, str):
                    text = c
                    break
                t = getattr(c, "text", None) or (c.get("text") if isinstance(c, dict) else None)
                if t:
                    text = t
                    break

    return text or ""

