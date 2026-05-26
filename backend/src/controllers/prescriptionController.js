const { matchAllTokens } = require('../utils/drugMatcher.js');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;

function extractDrugTokens(ocrRaw, vlmStructured) {
    const tokens = new Set();

    if (Array.isArray(vlmStructured)) {
        for (const entry of vlmStructured) {
            // Handle both string[] and {drug}[] formats
            const name = typeof entry === 'string' ? entry.trim() : entry.drug?.trim();
            if (name && name.length >= 3) tokens.add(name);
        }
    }

    // Grab capitalised words immediately before a dosage pattern
    if (ocrRaw) {
        const pattern = /([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s*\d+\s*(?:mg|ml|mcg|g|iu)/gi;
        let m;
        while ((m = pattern.exec(ocrRaw)) !== null) {
            const t = m[1].trim();
            if (t.length >= 3) tokens.add(t);
        }
    }

    return [...tokens];
}

async function verifyWithGemini(ocrRaw, vlmStructured, candidates, apiKey) {
    const prompt = `You are a Bangladeshi prescription analyzer.
Given OCR text and drug candidates from fuzzy DB matching, pick the best DB match for each extracted token.

RAW OCR TEXT:
${ocrRaw}

VLM EXTRACTION:
${JSON.stringify(vlmStructured)}

FUZZY MATCH CANDIDATES (token → top DB matches):
${JSON.stringify(candidates, null, 2)}

Rules:
- Use dosage/strength visible in the OCR to disambiguate between candidates.
- If no candidate has similarity > 0.3, set confidence to "low".
- Return ONLY a valid JSON array, no markdown:

[{
  "extracted_name": "original token",
  "matched_brand": "best brand from DB or null",
  "generic": "generic name or null",
  "strength": "strength from DB or null",
  "form": "tablet/syrup/etc or null",
  "confidence": "high|medium|low",
  "dosage_from_prescription": "what the doctor wrote or null",
  "frequency": "1+0+1 style or null",
  "duration": "e.g. 7 days or null"
}]`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
        })
    });

    if (!response.ok) throw new Error(`Gemini API returned ${response.status}`);

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Empty Gemini response');

    return JSON.parse(raw.trim());
}

class PrescriptionController {
    analyzePrescription = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'Image file required' });
            }

            if (!PYTHON_SERVICE_URL) {
                return res.status(500).json({ success: false, error: 'PYTHON_SERVICE_URL not configured' });
            }

            console.log(`[Prescription] Received image: ${req.file.originalname} (${(req.file.size/1024).toFixed(1)} KB)`);

            // 1. Forward image to Modal Python service
            const form = new FormData();
            form.append(
                'file',
                new Blob([req.file.buffer], { type: req.file.mimetype }),
                req.file.originalname || 'prescription.jpg'
            );

            console.log(`[Prescription] Calling Python service...`);
            const t0 = Date.now();

            const extractionRes = await fetch(`${PYTHON_SERVICE_URL}/extract`, {
                method: 'POST',
                body: form
            });

            if (!extractionRes.ok) {
                const detail = await extractionRes.text();
                throw new Error(`Python service error ${extractionRes.status}: ${detail}`);
            }

            const extraction = await extractionRes.json();
            console.log(`\n── Python Service Output (${((Date.now()-t0)/1000).toFixed(1)}s) ─────────────────────`);
            console.log(`  VLM available : ${extraction.vlm_available}`);
            console.log(`  OCR raw text  :\n    ${(extraction.ocr_raw || '').replace(/\n/g, '\n    ')}`);
            console.log(`  VLM raw output:\n    ${(extraction.vlm_raw || '(none)').replace(/\n/g, '\n    ')}`);
            console.log(`  VLM structured:`);
            console.log('   ', JSON.stringify(extraction.vlm_structured, null, 2).replace(/\n/g, '\n    '));
            console.log(`─────────────────────────────────────────────────────────────────\n`);

            // 2. Extract candidate drug tokens
            const tokens = extractDrugTokens(extraction.ocr_raw, extraction.vlm_structured);
            console.log(`[Prescription] Extracted ${tokens.length} token(s): ${tokens.join(', ')}`);

            if (tokens.length === 0) {
                return res.status(200).json({
                    success: true,
                    drugs: [],
                    needs_review: [],
                    ocr_raw: extraction.ocr_raw,
                    vlm_available: extraction.vlm_available,
                    diseases: extraction.diseases || [],
                    tests:    extraction.tests    || [],
                    message: 'No drug names detected in the image'
                });
            }

            // 3. Fuzzy match every token against the drugs table
            console.log(`[Prescription] Running fuzzy match against drugs table...`);
            const candidates = await matchAllTokens(tokens);
            const matchedCount = Object.values(candidates).filter(c => c.length > 0).length;
            console.log(`\n── Fuzzy Match Results (${matchedCount}/${tokens.length} tokens matched) ──────────────`);
            for (const [token, matches] of Object.entries(candidates)) {
                if (matches.length === 0) {
                    console.log(`  "${token}" → no matches`);
                } else {
                    console.log(`  "${token}" →`);
                    matches.forEach((m, i) => {
                        const sim = Math.max(m.brand_sim ?? 0, m.generic_sim ?? 0).toFixed(2);
                        console.log(`    [${i+1}] ${m.brand} (${m.generic || '?'}) ${m.strength || ''} ${m.form || ''} | sim=${sim}`);
                    });
                }
            }
            console.log(`─────────────────────────────────────────────────────────────────\n`);

            // 4. LLM verification to select the best match and add prescription context
            let drugs = [];
            const apiKey = process.env.GEMINI_API_KEY;

            if (apiKey) {
                console.log(`[Prescription] Calling Gemini for verification...`);
                drugs = await verifyWithGemini(
                    extraction.ocr_raw,
                    extraction.vlm_structured,
                    candidates,
                    apiKey
                );
                console.log(`\n── Gemini Verification Output ────────────────────────────────────`);
                drugs.forEach((d, i) => {
                    console.log(`  [${i+1}] "${d.extracted_name}" → ${d.matched_brand} (${d.generic || '?'}) | confidence=${d.confidence} | dosage=${d.dosage_from_prescription || '?'} | freq=${d.frequency || '?'} | duration=${d.duration || '?'}`);
                });
                console.log(`─────────────────────────────────────────────────────────────────\n`);
            } else {
                // Fallback: return raw fuzzy results without LLM
                drugs = tokens.map(token => ({
                    extracted_name: token,
                    matched_brand: candidates[token]?.[0]?.brand || token,
                    generic: candidates[token]?.[0]?.generic || null,
                    strength: candidates[token]?.[0]?.strength || null,
                    form: candidates[token]?.[0]?.form || null,
                    confidence: candidates[token]?.length > 0 ? 'medium' : 'low',
                    dosage_from_prescription: null,
                    frequency: null,
                    duration: null,
                }));
            }

            const needs_review = drugs.filter(d => d.confidence === 'low');
            console.log(`[Prescription] Done — ${drugs.length} drug(s) extracted, ${needs_review.length} need review`);

            return res.status(200).json({
                success: true,
                drugs,
                needs_review,
                ocr_raw: extraction.ocr_raw,
                vlm_available: extraction.vlm_available,
                models_used: extraction.models_used || [],
                patient:  extraction.patient  || null,
                doctor:   extraction.doctor   || null,
                hospital: extraction.hospital || null,
                date:     extraction.date     || null,
                diseases: extraction.diseases || [],
                tests:    extraction.tests    || [],
            });

        } catch (error) {
            console.error('Prescription analysis error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
}

module.exports = PrescriptionController;
