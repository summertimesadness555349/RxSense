import modal

app = modal.App("rxsense-prescription-extractor")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxrender1",
        "libxext6",
        "ffmpeg",
        "libgomp1",
    )
    .pip_install(
        "fastapi[standard]>=0.110.0",
        "python-multipart>=0.0.9",
        "pillow>=10.0.0",
        "torch>=2.2.0",
        "torchvision>=0.17.0",
        "transformers>=4.45.0",
        "accelerate>=0.30.0",
        "huggingface_hub>=0.22.0",
        "easyocr>=1.7.0",
        "opencv-python-headless>=4.8.0",
    )
    .add_local_python_source("extract")
)

model_volume = modal.Volume.from_name("rxsense-model-cache", create_if_missing=True)

CACHE_DIR = "/model-cache"
ALLOWED_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


@app.function(
    image=image,
    gpu="T4",
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
    ],
    volumes={CACHE_DIR: model_volume},
    timeout=1800,
)
def download_models():
    """
    One-time setup: downloads MedGemma weights into the volume.
    Run before first deploy:  modal run modal_app.py::download_models
    """
    import os
    from extract import load_vlm

    os.environ["HF_HOME"] = f"{CACHE_DIR}/huggingface"
    os.environ["EASYOCR_MODULE_PATH"] = f"{CACHE_DIR}/easyocr"

    hf_token = os.environ.get("HF_TOKEN")
    print("Downloading MedGemma-4b-it...")
    load_vlm(hf_token)

    print("Downloading EasyOCR models (en + bn)...")
    import easyocr
    easyocr.Reader(['en', 'bn'], gpu=False)

    model_volume.commit()
    print("All models cached in volume.")


@app.function(
    image=image,
    gpu="T4",
    secrets=[
        modal.Secret.from_name("huggingface-secret"),
    ],
    volumes={CACHE_DIR: model_volume},
    scaledown_window=300,
)
@modal.asgi_app()
def serve():
    import os
    import tempfile
    from fastapi import FastAPI, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from extract import extract, load_vlm

    os.environ["HF_HOME"] = f"{CACHE_DIR}/huggingface"
    os.environ["EASYOCR_MODULE_PATH"] = f"{CACHE_DIR}/easyocr"

    hf_token = os.environ.get("HF_TOKEN")

    print("Loading MedGemma-4b-it...")
    try:
        if not hf_token:
            raise EnvironmentError("HF_TOKEN not set")
        processor, vlm_model = load_vlm(hf_token)
        print("MedGemma ready.")
    except Exception as exc:
        print(f"MedGemma unavailable: {exc}")
        processor = None
        vlm_model = None

    web_app = FastAPI(title="RxSense Prescription Extractor", version="2.0.0")
    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @web_app.get("/health")
    def health():
        return {
            "status": "ok",
            "medgemma_ready": processor is not None,
        }

    @web_app.post("/extract")
    async def extract_prescription(file: UploadFile):
        content_type = (file.content_type or "").lower()
        if content_type not in ALLOWED_MIME:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported type '{content_type}'. Send JPEG, PNG, or WEBP.",
            )

        ext = (
            "." + file.filename.rsplit(".", 1)[-1]
            if file.filename and "." in file.filename
            else ".jpg"
        )
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        try:
            return await extract(tmp_path, processor, vlm_model)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        finally:
            os.unlink(tmp_path)

    return web_app
