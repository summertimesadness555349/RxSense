#!/usr/bin/env python3
"""
extract_pdf.py  <pdf_path>  [--ocr]

Extracts text from a PDF.  Two modes:
  1. Text-based PDF  — PyMuPDF direct extraction (fast, accurate).
  2. Scanned PDF     — PyMuPDF renders pages to images → Tesseract OCR.
                       Requires: pip install pytesseract pillow
                                 + Tesseract installed on the system.

Auto-detects which mode is needed: if direct extraction yields < 100 chars/page
on average across the first 5 pages, it falls back to OCR (or errors if --ocr
not passed and Tesseract is unavailable).

Outputs JSON to stdout:
  { "mode": "text"|"ocr", "total_pages": N, "total_chars": N,
    "pages": [{"page": 1, "text": "..."}, ...] }
"""

import sys
import json
import io
import fitz   # PyMuPDF  (pip install pymupdf)


# ── Direct text extraction ────────────────────────────────────────────────────
def extract_text(doc) -> list[dict]:
    pages = []
    for i, page in enumerate(doc):
        text = page.get_text("text")
        text = "".join(c if c >= " " or c in "\n\t" else " " for c in text).strip()
        if text:
            pages.append({"page": i + 1, "text": text})
    return pages


# ── OCR extraction (requires Tesseract) ───────────────────────────────────────
def extract_ocr(doc, dpi: int = 300) -> list[dict]:
    try:
        import pytesseract
        from PIL import Image
    except ImportError:
        raise RuntimeError(
            "OCR dependencies missing.  Install with:\n"
            "  pip install pytesseract pillow\n"
            "  and install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki"
        )

    pages = []
    total = doc.page_count
    mat   = fitz.Matrix(dpi / 72, dpi / 72)

    for i, page in enumerate(doc, 1):
        pix  = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY)
        img  = Image.open(io.BytesIO(pix.tobytes("png")))
        text = pytesseract.image_to_string(img, lang="eng", config="--psm 6")
        text = text.strip()

        if text:
            pages.append({"page": i, "text": text})

        # Progress to stderr so it doesn't corrupt stdout JSON
        pct = round((i / total) * 100)
        print(f"\r  OCR: {i}/{total} pages ({pct}%)", file=sys.stderr, end="", flush=True)

    print(file=sys.stderr)  # newline after progress
    return pages


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    args     = sys.argv[1:]
    force_ocr = "--ocr" in args
    pdf_path  = next((a for a in args if not a.startswith("--")), None)

    if not pdf_path:
        print(json.dumps({"error": "Usage: extract_pdf.py <pdf_path> [--ocr]"}))
        sys.exit(1)

    doc = fitz.open(pdf_path)

    # Auto-detect: sample first 5 pages for text
    sample_chars = sum(
        len(p.get_text("text").strip())
        for p in list(doc)[:5]
    )
    avg_chars_per_page = sample_chars / min(5, doc.page_count)
    is_scanned = avg_chars_per_page < 100  # < 100 chars/page → no real text layer

    if is_scanned and not force_ocr:
        # Return a signal so chunkPdf.js knows to re-call with --ocr
        print(json.dumps({
            "mode": "needs_ocr",
            "total_pages": doc.page_count,
            "avg_sample_chars": avg_chars_per_page,
            "pages": [],
        }))
        return

    mode  = "ocr" if (is_scanned or force_ocr) else "text"
    pages = extract_ocr(doc) if mode == "ocr" else extract_text(doc)
    total = sum(len(p["text"]) for p in pages)

    print(json.dumps({
        "mode":           mode,
        "total_pages":    doc.page_count,
        "pages_with_text": len(pages),
        "total_chars":    total,
        "pages":          pages,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
