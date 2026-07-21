import os
import json
import base64
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

logger = logging.getLogger(__name__)

# Load backend/.env so OPENAI_API_KEY is available regardless of where uvicorn is launched from.
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

API_KEY = os.getenv("OPENAI_API_KEY")
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
# Vision falls back to the chat model (gpt-4o-mini is multimodal).
VISION_MODEL = os.getenv("OPENAI_VISION_MODEL", MODEL)

if not API_KEY:
    logger.warning("OPENAI_API_KEY is not set - AI features will use mock fallbacks.")

# max_retries covers rate limits / transient 5xx, replacing the old manual key rotation.
client = OpenAI(api_key=API_KEY, max_retries=3, timeout=30.0) if API_KEY else None


def _to_openai_messages(history: List[Dict[str, str]], system_instruction: str = None) -> List[Dict[str, str]]:
    """
    Converts the app's internal history format to OpenAI chat messages.
    Internally the assistant role is stored as "model" (a leftover of the Gemini format).
    """
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})

    for msg in history:
        role = "assistant" if msg["role"] in ("model", "assistant") else "user"
        messages.append({"role": role, "content": msg["content"]})

    return messages


def generate_ai_response(history: List[Dict[str, str]], system_instruction: str = None) -> Dict[str, Any]:
    """
    Calls the OpenAI Chat Completions API and returns the assistant's reply text.
    """
    if client is None:
        return {"text": "AI is not configured (missing OPENAI_API_KEY)."}

    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=_to_openai_messages(history, system_instruction),
            temperature=0.7,
            max_tokens=800,
        )
        return {"text": completion.choices[0].message.content or ""}

    except OpenAIError as e:
        logger.error("OpenAI chat error: %s", e)
        return {"text": "The AI service is temporarily unavailable. Please try again."}


# The categories the collection workflow understands.
WASTE_CATEGORIES = ("plastic", "organic", "paper", "metal", "glass", "ewaste", "hazardous", "mixed")

MOCK_ANALYSIS = {
    "waste_type": "mixed",
    "category": "mixed",
    "estimated_quantity_kg": 5.0,
    "description": "[MOCK] Detected mixed waste.",
    "recyclable": True,
    "handling_note": "[MOCK] Segregate before pickup.",
}


def _clean_analysis(data: Any) -> Dict[str, Any]:
    """
    Coerces a parsed model response into the shape WasteAnalysisResponse expects.
    Returns None if the payload cannot be salvaged, so the caller can fall back.
    """
    if not isinstance(data, dict):
        return None

    try:
        category = str(data["category"]).strip().lower()
        # Never let a hallucinated label reach the routing logic.
        if category not in WASTE_CATEGORIES:
            category = "mixed"

        return {
            "waste_type": str(data.get("waste_type") or category),
            "category": category,
            "estimated_quantity_kg": float(data["estimated_quantity_kg"]),
            "description": str(data["description"]),
            "recyclable": bool(data.get("recyclable", False)),
            "handling_note": str(data.get("handling_note") or ""),
        }
    except (KeyError, TypeError, ValueError):
        return None


def analyze_image(image_data: bytes, mime_type: str) -> Dict[str, Any]:
    """
    Analyzes a waste image to detect waste type and estimated quantity.
    Returns a dict with waste_type / estimated_quantity_kg / description.
    Falls back to MOCK_ANALYSIS if the AI call fails or returns an unusable shape.
    """
    prompt = (
        "You are a waste sorting assistant. Analyze this waste image and return ONLY valid JSON. "
        "Keys: "
        f"'category' (exactly one of: {', '.join(WASTE_CATEGORIES)}), "
        "'waste_type' (a short specific label, e.g. 'PET bottles', 'vegetable peels'), "
        "'estimated_quantity_kg' (float estimate), "
        "'description' (one short sentence describing what you see), "
        "'recyclable' (boolean), "
        "'handling_note' (one short sentence on how the collection team should handle it). "
        "Be conservative with weight estimates. "
        "Use 'hazardous' for medical, chemical or battery waste, and 'ewaste' for electronics."
    )

    if client is not None:
        # OpenAI accepts images as data URIs; default to jpeg if the upload had no content type.
        b64_image = base64.b64encode(image_data).decode("utf-8")
        data_uri = f"data:{mime_type or 'image/jpeg'};base64,{b64_image}"

        try:
            completion = client.chat.completions.create(
                model=VISION_MODEL,
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_uri}},
                    ],
                }],
                response_format={"type": "json_object"},
                max_tokens=300,
            )
            analysis = _clean_analysis(json.loads(completion.choices[0].message.content))
            if analysis:
                return analysis
            logger.error("Vision response did not match the expected shape.")

        except OpenAIError as e:
            logger.error("OpenAI vision error: %s", e)
        except (json.JSONDecodeError, TypeError) as e:
            logger.error("Could not parse vision response as JSON: %s", e)

    # Mock fallback so the demo flow still works when the API is unavailable.
    return dict(MOCK_ANALYSIS)
