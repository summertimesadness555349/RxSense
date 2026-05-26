# RxSense Prescription Extractor

FastAPI service deployed on [Modal](https://modal.com) that extracts drug names and dosages from prescription images using EasyOCR + MedGemma-4b.

## Files

```
python-service/
├── modal_app.py   — Modal deployment (image, volume, GPU function, FastAPI routes)
├── extract.py     — EasyOCR + MedGemma extraction logic
└── requirements.txt — Local dev only (just the modal CLI)
```

## One-time setup

### 1. Install Modal CLI locally
```bash
pip install modal
modal setup   # opens browser to authenticate
```

### 2. Accept MedGemma terms
Visit [google/medgemma-4b-it](https://huggingface.co/google/medgemma-4b-it) and accept the model license with your HuggingFace account.

### 3. Create a HuggingFace token
Go to [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) → New token → **Read** access.

### 4. Create a Modal secret named `huggingface-secret`
```bash
modal secret create huggingface-secret HF_TOKEN=hf_your_token_here
```
Or via the Modal dashboard: Secrets → New secret → name it exactly `huggingface-secret`.

### 5. Pre-download model weights into the volume (run once)
```bash
modal run modal_app.py::download_models
```
This downloads EasyOCR + MedGemma (~8GB) into a persistent Modal volume so cold starts load from cache, not the internet.

### 6. Deploy
```bash
modal deploy modal_app.py
```
Modal prints the live URL, e.g. `https://your-workspace--rxsense-prescription-extractor-serve.modal.run`

---

## API

### `POST /extract`
Upload a prescription image. Field name: `file`.

```bash
curl -X POST https://<your-modal-url>/extract \
  -F "file=@prescription.jpg"
```

**Response:**
```json
{
  "ocr_raw": "Napa Extra 500mg 1+0+1 x7 ...",
  "vlm_raw": "[{\"drug\": \"Napa Extra\", ...}]",
  "vlm_structured": [
    {
      "drug": "Napa Extra",
      "dosage": "500mg",
      "frequency": "1+0+1",
      "duration": "7 days",
      "instructions": "after meal"
    }
  ],
  "vlm_available": true
}
```

If MedGemma failed to load, `vlm_available` is `false` and `vlm_structured` is `[]` — OCR text is still returned.

### `GET /health`
```json
{ "status": "ok", "ocr_ready": true, "vlm_ready": true }
```

---

## Cost estimate (Modal T4)
| Action | Cost |
|---|---|
| `download_models` (one-time, ~10 min) | ~$0.10 |
| Per request (warm container) | ~$0.001 |
| Per request (cold start, model load ~2 min) | ~$0.02 |
| 5-min idle keepalive | ~$0.05/hr |

$30 credit gives you plenty of runway for a hackathon.
