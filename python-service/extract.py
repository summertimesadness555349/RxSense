import json
import re
import asyncio
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForImageTextToText

MODEL_ID = "google/medgemma-4b-it"


def load_vlm(hf_token: str | None = None) -> tuple:
    kwargs = {"torch_dtype": torch.bfloat16, "device_map": "auto"}
    token_kwarg = {"token": hf_token} if hf_token else {}
    processor = AutoProcessor.from_pretrained(MODEL_ID, **token_kwarg)
    model = AutoModelForImageTextToText.from_pretrained(MODEL_ID, **kwargs, **token_kwarg)
    model.eval()
    return processor, model


# ─── EasyOCR ─────────────────────────────────────────────────────────────────

def ocr_extract(image_path: str) -> str:
    import easyocr
    reader = easyocr.Reader(['en', 'bn'], gpu=torch.cuda.is_available())
    results = reader.readtext(image_path, detail=1)
    lines = [text for (_, text, conf) in results if conf > 0.25]
    return ' '.join(lines).strip()


# ─── MedGemma structured extraction ──────────────────────────────────────────

def _build_prompt(ocr_text: str) -> str:
    return f"""You are analyzing a Bangladeshi prescription image.

OCR TEXT extracted from the image (may contain errors — use only as a hint):
{ocr_text or 'unavailable'}

Instructions:
- Extract ONLY actual medications/drugs that are prescribed. Drug names only — no dosages.
- Put disease/diagnosis names (e.g. De Quervain, Gastritis, Hypertension) in the "diseases" array.
- Put required lab tests (e.g. RBS, CBC, HbA1c, Urine R/E) in the "tests" array.
- Do NOT put diseases or lab tests inside the drugs array.
- If a word makes no pharmacological sense as a drug, omit it from drugs.

Return ONLY a valid JSON object with no extra text or markdown:
{{
  "patient": {{
    "name": "patient name or null",
    "age": "age or null",
    "gender": "male/female/other or null",
    "phone": "phone or null",
    "address": "address or null"
  }},
  "doctor": {{
    "name": "doctor name or null",
    "designation": "e.g. MBBS, MD, FCPS or null",
    "specialization": "e.g. Medicine, Cardiology or null",
    "chamber": "chamber/clinic name or null",
    "phone": "phone or null"
  }},
  "hospital": {{
    "name": "hospital or clinic name or null",
    "address": "address or null"
  }},
  "date": "prescription date or null",
  "diseases": ["disease or diagnosis name"],
  "tests": ["required lab test name"],
  "drugs": ["drug brand name as written"],
  "notes": "any other instructions or null"
}}"""


def _parse_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return {}


def _medgemma_extract_sync(image_path: str, processor, model, ocr_text: str) -> dict:
    image = Image.open(image_path).convert("RGB")
    prompt = _build_prompt(ocr_text)

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)

    input_len = inputs["input_ids"].shape[-1]

    with torch.inference_mode():
        generation = model.generate(**inputs, max_new_tokens=1024, do_sample=False)
        generation = generation[0][input_len:]

    raw = processor.decode(generation, skip_special_tokens=True).strip()
    return _parse_json(raw)


# ─── Dosage extraction (given confirmed drug names) ──────────────────────────

def _build_dosage_prompt(drug_names: list) -> str:
    names = '\n'.join(f'- {n}' for n in drug_names)
    return f"""You are analyzing a Bangladeshi prescription image.

The following medications are confirmed to be prescribed in this image:
{names}

Look at the prescription image and for EACH medication above, find and extract the exact dosage, frequency, and duration written next to it.

Return ONLY a valid JSON array with no extra text or markdown:
[
  {{
    "name": "medication name exactly as listed above",
    "dosage": "e.g. 500mg, 100mg, 40mg — or null if not visible",
    "frequency": "e.g. 1+0+1, 0+0+1, twice daily — or null if not visible",
    "duration": "e.g. 7 days, 10 days, 1 month — or null if not visible",
    "instructions": "e.g. after meal, before meal, apply locally — or null if not visible"
  }}
]"""


def _parse_json_array(text: str) -> list:
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except json.JSONDecodeError:
        pass
    match = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    match = re.search(r"\[.*\]", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return []


def _extract_dosages_sync(image_path: str, drug_names: list, processor, model) -> list:
    image = Image.open(image_path).convert("RGB")
    prompt = _build_dosage_prompt(drug_names)

    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompt},
            ],
        }
    ]

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt",
    ).to(model.device)

    input_len = inputs["input_ids"].shape[-1]

    with torch.inference_mode():
        generation = model.generate(**inputs, max_new_tokens=512, do_sample=False)
        generation = generation[0][input_len:]

    raw = processor.decode(generation, skip_special_tokens=True).strip()
    return _parse_json_array(raw)


async def extract_dosages(image_path: str, drug_names: list, processor=None, model=None) -> list:
    """Given confirmed drug names, use MedGemma to extract dosage/frequency/duration from the image."""
    if not drug_names or processor is None or model is None:
        return []

    def _run():
        try:
            return _extract_dosages_sync(image_path, drug_names, processor, model)
        except Exception as exc:
            print(f"[extract_dosages] MedGemma failed: {exc}")
            return []

    return await asyncio.to_thread(_run)


# ─── Deduplication ────────────────────────────────────────────────────────────

def _deduplicate(items: list) -> list:
    seen: set = set()
    result = []
    for item in items:
        name = str(item).lower().strip()
        if len(name) >= 2 and name not in seen:
            seen.add(name)
            result.append(item)
    return result


# ─── Main entry point ─────────────────────────────────────────────────────────

async def extract(image_path: str, processor=None, model=None) -> dict:
    """
    1. EasyOCR     → raw OCR text
    2. MedGemma    → structured JSON (drugs, diseases, tests)
    3. deduplicate → clean lists
    """
    def _run_blocking() -> dict:
        ocr_text = ""
        try:
            ocr_text = ocr_extract(image_path)
        except Exception as exc:
            print(f"[extract] EasyOCR failed: {exc}")

        result: dict = {}
        if processor is not None and model is not None:
            try:
                result = _medgemma_extract_sync(image_path, processor, model, ocr_text)
            except Exception as exc:
                print(f"[extract] MedGemma failed: {exc}")

        drugs = _deduplicate(result.get("drugs") or [])
        diseases = _deduplicate(result.get("diseases") or [])
        tests = _deduplicate(result.get("tests") or [])

        models_used = []
        if ocr_text:
            models_used.append("easyocr")
        if result:
            models_used.append("medgemma")

        return {
            "patient":   result.get("patient"),
            "doctor":    result.get("doctor"),
            "hospital":  result.get("hospital"),
            "date":      result.get("date"),
            "diseases":  diseases,
            "tests":     tests,
            "notes":     result.get("notes"),
            "drugs":     drugs,
            "ocr_raw":   ocr_text or None,
            "models_used":    models_used,
            "vlm_available":  bool(result),
            "vlm_structured": drugs,  # backward-compat for Node.js controller
        }

    return await asyncio.to_thread(_run_blocking)
