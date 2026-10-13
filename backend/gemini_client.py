import os
import re
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import BaseModel

from backend.prompConfig import SystemInstruction

dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path)

_genai_client = None


class BotReply(BaseModel):
    """The structured answer Gemini is asked to return."""
    reply: str
    urgent: bool = False
    question_for_doctor: Optional[str] = None
    web_search_query: Optional[str] = None


# How long a product lookup is reused before searching again
LOOKUP_CACHE_SECONDS = 7 * 24 * 60 * 60

# Fallback when Redis is not running: lookups done since the server started
# Product lookups already done since the server started: query -> (summary, sources)
_lookup_cache = {}


def lookup_on_web(query: str):
    """
    Search the web for facts about a medicine or product.

    Only the query is sent, never any patient details. Returns (summary, sources)
    or None when the lookup fails. Uses its own model because web search is not
    available on every Gemini model.

    Results are cached in Redis for a week and shared by all patients, since they
    describe a product and contain nothing about a person.
    """
    from backend.cache import cache_get, cache_set

    key = " ".join(query.lower().split())
    cached = cache_get(f"lookup:{key}")
    if cached:
        return cached["summary"], cached["sources"]
    """
    key = " ".join(query.lower().split())
    if key in _lookup_cache:
        return _lookup_cache[key]

    client = get_genai_client()
    from google.genai import types

    try:
        response = client.models.generate_content(
            model=os.getenv("GEMINI_SEARCH_MODEL", "gemini-2.5-flash"),
            contents=f"""
            Search the web for reliable information about: {query}

            Summarise only what the search results say, in under 180 words: what the product is,
            what it is used for, its key ingredients, how it is normally used, and its known side
            effects or cautions. If the results are unclear, conflict with each other, or may be
            about a different product with a similar name, say so plainly. Do not add advice.
            """,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
                temperature=0.2,
            ),
        )
    except Exception as e:
        print(f"Web lookup failed: {e}")
        return None

    summary = (response.text or "").strip()
    if not summary:
        return None

    sources = []
    metadata = response.candidates[0].grounding_metadata if response.candidates else None
    for chunk in (metadata.grounding_chunks if metadata and metadata.grounding_chunks else []):
        web = getattr(chunk, "web", None)
        if web and web.uri and not any(s["title"] == (web.title or web.uri) for s in sources):
            sources.append({"title": web.title or web.uri, "url": web.uri})

    _lookup_cache[key] = (summary, sources[:4])
    cache_set(f"lookup:{key}", {"summary": summary, "sources": sources[:4]}, LOOKUP_CACHE_SECONDS)
    return _lookup_cache[key]


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


def build_patient_context(patient: dict) -> str:
    """Format the patient profile and the doctor's notes (loaded from Postgres) for the prompt."""
    context = f"""
    Patient Profile:
    Name: {patient.get('name') or 'N/A'}
    Age: {patient.get('age') or 'N/A'}
    Gender: {patient.get('gender') or 'N/A'}
    Medical History: {patient.get('medical_history') or 'N/A'}
    Email: {patient.get('email') or 'N/A'}
    """

    for cond in patient.get("conditions") or []:
        context += f"""
    Doctor's notes for condition: {cond.get('diagnosis') or 'N/A'}
    Description: {cond.get('description') or 'N/A'}
    Medication Instructions: {cond.get('medication_instructions') or 'N/A'}
    Follow-up Guidelines: {cond.get('follow_up_guidelines') or 'N/A'}
    Lifestyle Recommendations: {cond.get('lifestyle_recommendations') or 'N/A'}
    Warning Symptoms: {cond.get('warning_symptoms') or 'N/A'}
    Other Comments: {cond.get('other_notes') or 'N/A'}
    """

    for question in patient.get("questions") or []:
        if question.get("answer"):
            context += f"""
    Earlier question from the patient: {question.get('question')}
    Doctor's answer: {question.get('answer')}
    """
        elif not question.get("resolved"):
            context += f"""
    Question already sent to the doctor, waiting for a reply: {question.get('question')}
    """

    return context



    for cond in patient.get("conditions") or []:
        context += f"""
    Doctor's notes for condition: {cond.get('diagnosis') or 'N/A'}
    Description: {cond.get('description') or 'N/A'}
    Medication Instructions: {cond.get('medication_instructions') or 'N/A'}
    Follow-up Guidelines: {cond.get('follow_up_guidelines') or 'N/A'}
    Lifestyle Recommendations: {cond.get('lifestyle_recommendations') or 'N/A'}
    Warning Symptoms: {cond.get('warning_symptoms') or 'N/A'}
    Other Comments: {cond.get('other_notes') or 'N/A'}
    """

    for question in patient.get("questions") or []:
        if question.get("answer"):
            context += f"""
    Earlier question from the patient: {question.get('question')}
    Doctor's answer: {question.get('answer')}
    """
        elif not question.get("resolved"):
            context += f"""
    Question already sent to the doctor, waiting for a reply: {question.get('question')}
    """

    return context


def chat_with_gemini(patient: dict, prompt: str, history: Optional[List[dict]] = None, allow_web_lookup: bool = True) -> dict:
    """
    Generate a reply using Gemini with patient-specific instructions.

    history is the earlier conversation as [{"from": "patient" | "bot", "content": str}].
    Returns {"reply": str, "urgent": bool, "question_for_doctor": str | None, "sources": list}.
    sources lists the web pages used when the bot looked a product up online.
    allow_web_lookup=False skips that lookup (used by the evaluation suite so results
    do not depend on live search).
    """
    client = get_genai_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY not set or google-genai not installed")

    from google.genai import types

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    patient_context = build_patient_context(patient)

    system_instruction = f"""
    {SystemInstruction.system_prompt}

    Additional formatting rules for the reply:
    - Return plain text only.
    - Do not use markdown headings like ### or ##.
    - Do not use bullet lists or numbered lists.
    - Keep it simple, calm, and conversational.

    Patient context:
    {patient_context}
    """

    contents = [
        types.Content(
            role="user" if message["from"] == "patient" else "model",
            parts=[types.Part(text=message["content"])],
        )
        for message in history or []
        if message.get("content")
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=prompt)]))

    def generate(instruction: str) -> Optional[BotReply]:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=instruction,
                temperature=0.2,
                response_mime_type="application/json",
                response_schema=BotReply,
            ),
        )
        if isinstance(response.parsed, BotReply):
            return response.parsed
        return BotReply.model_validate_json(response.text) if response.text else None

    parsed = generate(system_instruction)

    # The bot asked to look a product up: fetch the facts and let it answer again with them
    sources = []
    query = (parsed.web_search_query or "").strip() if parsed else ""
    if query and allow_web_lookup:
        lookup = lookup_on_web(query)
        if lookup:
            summary, sources = lookup
            try:
                parsed = generate(system_instruction + f"""
    Web lookup results for "{query}" (searched online just now):
    {summary}

    Use these results in your reply: briefly say what the product is, mention the relevant
    ingredients or properties, and then answer the patient's question from them.
    """) or parsed
            except Exception as e:
                # Keep the first answer if the second call fails
                print(f"Gemini error after web lookup: {e}")
                sources = []


    parsed = generate(system_instruction)

    # The bot asked to look a product up: fetch the facts and let it answer again with them
    sources = []
    query = (parsed.web_search_query or "").strip() if parsed else ""
    if query and allow_web_lookup:
        lookup = lookup_on_web(query)
        if lookup:
            summary, sources = lookup
            try:
                parsed = generate(system_instruction + f"""
    Web lookup results for "{query}" (searched online just now):
    {summary}

    Use these results in your reply: briefly say what the product is, mention the relevant
    ingredients or properties, and then answer the patient's question from them.
    """) or parsed
            except Exception as e:
                # Keep the first answer if the second call fails
                print(f"Gemini error after web lookup: {e}")
                sources = []

    cleaned = (parsed.reply if parsed else "").strip()
    if not cleaned:
        patient_name = patient.get('name') or 'the patient'
        cleaned = f"Hi, I don't have enough information to answer that for {patient_name}. Please provide more details or ask your doctor."
    else:
        cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned)
        cleaned = cleaned.replace("###", "").replace("##", "")

    question = (parsed.question_for_doctor or "").strip() if parsed else ""
    return {
        "reply": cleaned,
        "urgent": bool(parsed and parsed.urgent),
        "question_for_doctor": question or None,
        "sources": sources,
    }


class DictatedNotes(BaseModel):
    """A doctor's spoken notes, transcribed and sorted into the note fields."""
    transcript: str
    diagnosis: Optional[str] = None
    description: Optional[str] = None
    medication_instructions: Optional[str] = None
    lifestyle_recommendations: Optional[str] = None
    follow_up_guidelines: Optional[str] = None
    warning_symptoms: Optional[str] = None
    medical_history: Optional[str] = None
    other_notes: Optional[str] = None


DICTATION_PROMPT = """
You are helping a doctor who is dictating notes about a patient. Listen to the recording and:

1. Write what the doctor said in transcript, in English. The doctor may mix English with Hindi or another language; translate those parts.
2. Sort what was said into these fields:
   - diagnosis: the patient's issue or condition, as a short name.
   - description: symptoms and details about the condition.
   - medication_instructions: every medicine, supplement or product, with dose, how often, when and for how long, exactly as said.
   - lifestyle_recommendations: diet, exercise, habits and things to avoid.
   - follow_up_guidelines: when to come back and any tests to bring or do.
   - warning_symptoms: symptoms that need urgent attention.
   - medical_history: past conditions, surgeries and allergies.
   - other_notes: anything else that does not fit above.

Rules:
- Use only what the doctor actually said. Never add advice, doses, medicines or details of your own.
- Leave a field empty when the doctor said nothing for it.
- Keep the doctor's meaning and numbers exactly. Tidy the wording into clear written notes, without filler words.
- If you could not hear a medicine name or a number clearly, write [unclear] in its place instead of guessing.
- If the recording has no speech, return an empty transcript and empty fields.
"""


def sort_dictation(audio: bytes, mime_type: str) -> dict:
    """Transcribe a doctor's recording and sort it into the condition note fields."""
    client = get_genai_client()
    if not client:
        raise RuntimeError("GEMINI_API_KEY not set or google-genai not installed")

    from google.genai import types

    response = client.models.generate_content(
        model=os.getenv("GEMINI_AUDIO_MODEL") or os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        contents=[
            types.Part.from_bytes(data=audio, mime_type=mime_type),
            DICTATION_PROMPT,
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
            response_schema=DictatedNotes,
        ),
    )
    parsed = response.parsed if isinstance(response.parsed, DictatedNotes) else DictatedNotes.model_validate_json(response.text)
    return {key: (value or "").strip() for key, value in parsed.model_dump().items()}

