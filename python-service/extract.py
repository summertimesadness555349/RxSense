import json
import re
import asyncio
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForImageTextToText

MODEL_ID = "google/medgemma-4b-it"


def load_vlm(hf_token: str | None = None) -> tuple:
    from transformers import BitsAndBytesConfig
    token_kwarg = {"token": hf_token} if hf_token else {}
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )
    processor = AutoProcessor.from_pretrained(MODEL_ID, **token_kwarg)
    model = AutoModelForImageTextToText.from_pretrained(
        MODEL_ID, quantization_config=bnb_config, device_map="auto", **token_kwarg
    )
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


# ─── Lab report extraction ───────────────────────────────────────────────────

def _build_report_prompt(report_type: str, ocr_text: str) -> str:
    return f"""You are a medical lab report digitization assistant. You are analyzing a medical lab report image.

Report type: {report_type or 'unknown'}

OCR TEXT extracted from the image (may contain errors — use only as a hint):
{ocr_text or 'unavailable'}

## How lab reports are structured
- Each row has: parameter name | value | unit | reference range | flag (H/L/HH/LL)
- Common flags: H = high, L = low, HH = critical high, LL = critical low
- Reference ranges are printed as "min – max" or "< max" or "> min"
- Sections group related tests (e.g. "Complete Blood Count", "Biochemistry", "Liver Function")
- Narrative sections (Impression, Findings, Conclusion) contain free text, not table rows

## Rules
- Extract EVERY parameter visible — do not skip any row
- Preserve values and units exactly as printed (e.g. "12.5", "g/dL", "4.0–11.0")
- For imaging/narrative sections (X-Ray, Ultrasound, ECG impression), put the text in "narrative", leave "entries" as []
- If a field is not visible, use null

Return ONLY a valid JSON object — no markdown, no extra text:
{{
  "report_type": "{report_type or 'extracted report type'}",
  "report_date": "date as written or null",
  "facility": "lab or hospital name or null",
  "ordering_doctor": "doctor name or null",
  "patient": {{
    "name": null,
    "age": null,
    "gender": null,
    "patient_id": null,
    "date_of_birth": null
  }},
  "sections": [
    {{
      "title": "section heading as written e.g. Complete Blood Count",
      "type": "lab_results or imaging or vitals or narrative or other",
      "entries": [
        {{
          "label": "parameter name",
          "value": "value exactly as printed",
          "unit": "unit or null",
          "reference_range": "normal range exactly as printed or null",
          "flag": "H or L or HH or LL or null",
          "status": "normal or high or low or critical or null"
        }}
      ],
      "narrative": "free text for imaging/impression sections, null for table sections"
    }}
  ],
  "overall_impression": "overall conclusion or null",
  "diagnoses": [],
  "recommendations": [],
  "clinical_notes": null,
  "follow_up": null
}}"""


def _medgemma_extract_report_sync(image_path: str, processor, model, report_type: str, ocr_text: str) -> dict:
    image = Image.open(image_path).convert("RGB")
    prompt = _build_report_prompt(report_type, ocr_text)

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


async def extract_report(image_path: str, report_type: str, processor=None, model=None) -> dict:
    """Extract structured lab report data from an image using MedGemma."""
    if processor is None or model is None:
        raise RuntimeError("MedGemma model not loaded")

    ocr_text = ""
    try:
        ocr_text = ocr_extract(image_path)
    except Exception as exc:
        print(f"[extract_report] EasyOCR failed: {exc}")

    def _run():
        return _medgemma_extract_report_sync(image_path, processor, model, report_type, ocr_text)

    return await asyncio.to_thread(_run)


# ─── Dosage extraction (given confirmed drug names) ──────────────────────────

def _build_dosage_prompt(drug_names: list) -> str:
    names = '\n'.join(f'- {n}' for n in drug_names)
    return f"""You are analyzing a Bangladeshi prescription image written by a doctor.

## How Bangladeshi prescriptions show dosage (read this carefully)

**Frequency notation** — doctors write tablet counts as morning+afternoon+night:
  - 1+0+1  → one tablet morning, none afternoon, one at night
  - 1+1+1  → one tablet three times daily
  - 0+0+1  → one tablet at night only
  - 1+0+0  → one tablet in the morning only
  - 0+1+1  → one tablet afternoon and night
  - ½+0+½  → half tablet twice daily
  Some doctors write 4-part: 1+0+0+1 (morning+noon+evening+night)

**Meal instructions** — written as abbreviations or Bengali:
  - PC or "PC" or "খাবার পরে"  → after meal
  - AC or "AC" or "খাবার আগে" → before meal
  - HS or "রাতে ঘুমানোর আগে"  → at bedtime
  - SOS or "প্রয়োজনে"         → as needed

**Duration** — written as "× N days", "Nx" or just "N days / N দিন":
  - × 5, ×7, × 10 days, 1 month, 2 সপ্তাহ

**Dosage strength** — written right after the drug name or on the same line:
  - 500mg, 5mg, 10mg, 40mg, 250mg/5ml, 0.5%, 1g

**Typical line format on a Bangladeshi prescription:**
  Tab. Napa 500mg   1+0+1   × 7 days   PC
  Cap. Omeprazole 20mg   0+0+1   10 days   AC
  Syp. Amoxicillin 125mg/5ml   1 tsp 1+1+1   5 days
  Oint. Fusidic Acid 2%   apply locally   twice daily

---

The following medications are confirmed to be prescribed in this image:
{names}

Look at the prescription image carefully. For EACH medication above, find the line where that drug is written and extract the dosage strength, frequency notation, duration, and meal instruction written next to it.

## Few-shot examples of correct output

If the image showed: "Tab. Metformin 500mg  1+0+1  × 30 days  PC"
And: "Cap. Omeprazole 20mg  0+0+1  14 days  AC"
The correct output would be:
[
  {{"name": "Metformin", "dosage": "500mg", "frequency": "1+0+1", "duration": "30 days", "instructions": "after meal"}},
  {{"name": "Omeprazole", "dosage": "20mg", "frequency": "0+0+1", "duration": "14 days", "instructions": "before meal"}}
]

If the image showed: "Napa Extra  1+1+1  5 days" with no meal instruction:
[
  {{"name": "Napa Extra", "dosage": null, "frequency": "1+1+1", "duration": "5 days", "instructions": null}}
]

---

Now extract from the actual image. Return ONLY a valid JSON array — no extra text, no markdown:
[
  {{
    "name": "medication name exactly as listed above",
    "dosage": "strength e.g. 500mg, 20mg, 125mg/5ml — or null if not visible",
    "frequency": "notation exactly as written e.g. 1+0+1, 0+0+1, twice daily — or null if not visible",
    "duration": "e.g. 7 days, 10 days, 1 month — or null if not visible",
    "instructions": "meal timing e.g. after meal, before meal, at bedtime, apply locally — or null if not visible"
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
