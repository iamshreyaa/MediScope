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

#     # ------------------------------
#     # ✅ ADDING ONLY REQUIRED LOGIC
#     # ------------------------------
#     patient = load_patient_profile(patient_id)

#     patient_context = f"""
#     Patient Profile:
#     Name: {patient.get('name', 'N/A')}
#     Age: {patient.get('age', 'N/A')}
#     Gender: {patient.get('gender', 'N/A')}
#     Medical History: {patient.get('medical_history', 'N/A')}
#     Email: {patient.get('email', 'N/A')}
#     """

#     # prepend patient context
#     prompt = patient_context + "\n\n" + prompt
#     # ------------------------------

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

#     cleaned = (text or "").strip()

#     if cleaned:
#         # normalize multiple blank lines
#         cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
#         # friendly greeting + patient name
#         patient_name = patient.get('name') or 'the patient'
#         final = f"Hi,\n\nHere's a brief summary for {patient_name}:\n\n{cleaned}"
#     else:
#         patient_name = patient.get('name') or 'the patient'
#         final = f"Hi,\n\nI don't have enough information to produce a summary for {patient_name}. Please provide more details or specific questions and I'll help."

#     return final


import os
import re
from dotenv import load_dotenv
from backend.firebase import db
from backend.prompConfig import SystemInstruction

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
    """Generate text using Gemini with patient-specific instructions."""
    client = get_genai_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY not set or google-genai not installed")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    patient = load_patient_profile(patient_id)

    patient_context = f"""
    Patient Profile:
    Name: {patient.get('name', 'N/A')}
    Age: {patient.get('age', 'N/A')}
    Gender: {patient.get('gender', 'N/A')}
    Medical History: {patient.get('medical_history', 'N/A')}
    Email: {patient.get('email', 'N/A')}
    """

    final_prompt = f"""
    {SystemInstruction.system_prompt}

    Additional formatting rules:
    - Return plain text only.
    - Do not use markdown headings like ### or ##.
    - Do not use bullet lists or numbered lists.
    - Keep it simple, calm, and conversational.
    - If the user asks a general question, answer only from the doctor’s notes and instructions.

    Patient context:
    {patient_context}

    User message:
    {prompt}
    """

    response = client.models.generate_content(model=model, contents=[final_prompt])

    text = None
    if hasattr(response, "text"):
        text = response.text
    else:
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

    cleaned = (text or "").strip()
    if not cleaned:
        patient_name = patient.get('name') or 'the patient'
        return f"Hi, I don't have enough information to answer that for {patient_name}. Please provide more details or ask your doctor."

    cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
    cleaned = cleaned.replace("###", "").replace("##", "")
    return cleaned

