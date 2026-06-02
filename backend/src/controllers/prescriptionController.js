const sharp                        = require('sharp');
const { matchAllTokens }           = require('../utils/drugMatcher.js');
const { uploadPrescriptionBuffer } = require('../utils/cloudinary.js');
const DB_Connection                = require('../database/db.js');

// Formats PrescriptoAI cannot handle — convert to JPEG first
const UNSUPPORTED_MIMETYPES = new Set([
    'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp',
]);

async function toJpeg(buffer) {
    return sharp(buffer).jpeg({ quality: 90 }).toBuffer();
}

const PRESCRIPTO_URL     = 'https://www.prescriptoai.com/api/v1/prescription/extract';
const PRESCRIPTO_API_KEY = process.env.PRESCRIPTO_API_KEY;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function callPrescriptoAI(fileBuffer, mimetype, filename) {
    const form = new FormData();
    form.append(
        'prescription',
        new Blob([fileBuffer], { type: mimetype }),
        filename || 'prescription.jpg'
    );

    const response = await fetch(PRESCRIPTO_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PRESCRIPTO_API_KEY}` },
        body: form,
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
        throw new Error(`PrescriptoAI error ${response.status}: ${json.message || JSON.stringify(json)}`);
    }
    return json.data;
}

async function callMedGemmaDosages(fileBuffer, mimetype, filename, drugNames) {
    if (!PYTHON_SERVICE_URL || !drugNames.length) return [];

    const form = new FormData();
    form.append('file', new Blob([fileBuffer], { type: mimetype }), filename || 'prescription.jpg');
    form.append('drug_names', JSON.stringify(drugNames));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    try {
        const response = await fetch(`${PYTHON_SERVICE_URL}/extract-dosages`, {
            method: 'POST',
            body: form,
            signal: controller.signal,
        });
        if (!response.ok) return [];
        const json = await response.json();
        return json.dosages || [];
    } catch (err) {
        if (err.name === 'AbortError') {
            console.warn('[Prescription] MedGemma dosage call timed out — using PrescriptoAI values');
        } else {
            console.warn('[Prescription] MedGemma dosage call failed:', err.message);
        }
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

async function saveScan(db, { userId, imageUrl, imagePublicId, data, drugs, confidence, modelsUsed }) {
    const rx = data.prescription || {};
    const isUUID = UUID_RE.test(String(userId || ''));

    try {
        const result = await db.query_executor(
            `INSERT INTO prescription_scan
                (user_id, patient_id, image_url, image_public_id,
                 doctor_name, doctor_specialty, doctor_qualification, hospital_name,
                 patient_name_rx, patient_json, rx_date, diseases, tests, medications,
                 notes, follow_up, confidence, models_used)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
             RETURNING *`,
            [
                isUUID ? null : parseInt(userId) || null,           // user_id (integer)
                isUUID ? userId : null,                              // patient_id (UUID)
                imageUrl,
                imagePublicId || null,
                data.doctor?.name        || null,
                data.doctor?.specialization || null,
                data.doctor?.qualification || null,
                data.clinic?.name        || null,
                data.patient?.name       || null,
                JSON.stringify(data.patient || {}),
                rx.date                  || null,
                JSON.stringify(rx.diagnosis ? [rx.diagnosis] : []),
                JSON.stringify(rx.tests   || []),
                JSON.stringify(drugs),
                rx.notes    || null,
                rx.followUp || null,
                confidence  || null,
                JSON.stringify(modelsUsed || []),
            ]
        );
        return result.rows[0];
    } catch (err) {
        console.warn('[Prescription] Failed to save scan to DB:', err.message);
        return null;
    }
}

class PrescriptionController {
    constructor() {
        this.db = DB_Connection.getInstance();
    }

    analyzePrescription = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'Image file required' });
            }

            if (!PRESCRIPTO_API_KEY) {
                return res.status(500).json({ success: false, error: 'PRESCRIPTO_API_KEY not configured' });
            }

            const userId = req.user?.id || null;

            console.log(`[Prescription] Received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

            // Convert unsupported formats (AVIF, HEIC, etc.) to JPEG for PrescriptoAI
            let apiBuffer   = req.file.buffer;
            let apiMimetype = req.file.mimetype;
            let apiFilename = req.file.originalname;
            if (UNSUPPORTED_MIMETYPES.has(req.file.mimetype?.toLowerCase())) {
                console.log(`[Prescription] Converting ${req.file.mimetype} → JPEG for API compatibility`);
                apiBuffer   = await toJpeg(req.file.buffer);
                apiMimetype = 'image/jpeg';
                apiFilename = req.file.originalname.replace(/\.[^.]+$/, '.jpg');
            }

            // 1. Upload image to Cloudinary + call PrescriptoAI in parallel
            console.log(`[Prescription] Uploading to Cloudinary + calling PrescriptoAI...`);
            const t0 = Date.now();

            const [cloudResult, data] = await Promise.all([
                uploadPrescriptionBuffer(req.file.buffer, userId || 'anon').catch(err => {
                    console.warn('[Prescription] Cloudinary upload failed:', err.message);
                    return null;
                }),
                callPrescriptoAI(apiBuffer, apiMimetype, apiFilename),
            ]);

            const imageUrl       = cloudResult?.secure_url || null;
            const imagePublicId  = cloudResult?.public_id  || null;

            console.log(`[Prescription] PrescriptoAI + Cloudinary done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
            console.log(`\n── PrescriptoAI Output ────────────────────────────────────────────`);
            console.log(JSON.stringify(data, null, 2));
            console.log(`──────────────────────────────────────────────────────────────────\n`);

            const medications = data.prescription?.medications || [];
            const diagnosis   = data.prescription?.diagnosis   || null;
            const rxDate      = data.prescription?.date        || null;
            const rxTests     = data.prescription?.tests       || [];
            const rxNotes     = data.prescription?.notes       || null;
            const rxFollowUp  = data.prescription?.followUp    || null;

            // 2. Extract drug name tokens
            const tokens = medications
                .map(m => (m.name || '').trim())
                .filter(n => n.length >= 2);

            console.log(`[Prescription] ${tokens.length} drug token(s): ${tokens.join(', ')}`);

            if (tokens.length === 0) {
                const scanRow = imageUrl ? await saveScan(this.db, {
                    userId, imageUrl, imagePublicId, data,
                    drugs: [], confidence: 0, modelsUsed: ['prescriptoai'],
                }) : null;

                return res.status(200).json({
                    success: true,
                    scans:   scanRow?.rows || [],
                    // vlm_available: true,
                    total:   result.rowCount,
                    message: 'No medications detected',
                });

                // return res.status(200).json({
                //     success:   true,
                //     scan_id:   scanRow?.scan_id   || null,
                //     image_url: imageUrl,
                //     medications: [],
                //     needs_review: [],
                //     patient:  data.patient || null,
                //     doctor:   data.doctor  || null,
                //     hospital: data.clinic  || null,
                //     date:     rxDate,
                //     diseases: diagnosis ? [diagnosis] : [],
                //     tests:    rxTests,
                //     notes:    rxNotes,
                //     followUp: rxFollowUp,
                //     models_used: ['prescriptoai'],
                //     message: 'No medications detected',
                // });
            }

            // 3. Fuzzy match + MedGemma dosages in parallel
            console.log(`[Prescription] Fuzzy match + MedGemma dosage extraction (parallel)...`);
            const t1 = Date.now();

            const [candidates, medGemmaDosages] = await Promise.all([
                matchAllTokens(tokens),
                callMedGemmaDosages(req.file.buffer, req.file.mimetype, req.file.originalname, tokens),
            ]);

            console.log(`[Prescription] Parallel calls done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

            // Index MedGemma results by lowercased name
            const dosageMap = {};
            for (const d of medGemmaDosages) {
                if (d.name) dosageMap[d.name.toLowerCase()] = d;
            }

            // 4. Build final drugs list
            const drugs = medications.map(med => {
                const name     = (med.name || '').trim();
                const topMatch = candidates[name]?.[0];
                const sim      = topMatch ? Math.max(topMatch.brand_sim ?? 0, topMatch.generic_sim ?? 0) : 0;
                const gemma    = dosageMap[name.toLowerCase()] || {};

                return {
                    extracted_name:           name,
                    matched_brand:            topMatch?.brand || name,
                    generic:                  med.genericName || topMatch?.generic || null,
                    strength:                 topMatch?.strength || null,
                    form:                     topMatch?.form || null,
                    confidence:               sim >= 0.5 ? 'high' : sim >= 0.3 ? 'medium' : 'low',
                    dosage_from_prescription: gemma.dosage    || med.dosage    || null,
                    frequency:                gemma.frequency || med.frequency || null,
                    duration:                 gemma.duration  || med.duration  || null,
                    instructions:             gemma.instructions || med.instructions || null,
                };
            });

            const needs_review = drugs.filter(d => d.confidence === 'low');
            const models_used  = ['prescriptoai', ...(medGemmaDosages.length ? ['medgemma'] : [])];

            // Average confidence score (0-100)
            const confMap = { high: 100, medium: 70, low: 30 };
            const confidence = drugs.length
                ? Math.round(drugs.reduce((s, d) => s + (confMap[d.confidence] ?? 50), 0) / drugs.length)
                : 0;

            // 5. Save to DB (non-blocking path — result returned regardless)
            const scanRow = imageUrl ? await saveScan(this.db, {
                userId, imageUrl, imagePublicId, data,
                drugs, confidence, modelsUsed: models_used,
            }) : null;

            console.log(`[Prescription] Done — ${drugs.length} drug(s), scan_id=${scanRow?.scan_id || 'not saved'}`);

            return res.status(200).json({
                success: true,
                scans:   scanRow?.rows || [],
                vlm_available: true,
                total:   result.rowCount,
            });
            
            // return res.status(200).json({
            //     success: true,
            //     scan_id:   scanRow?.scan_id   || null,
            //     image_url: imageUrl,
            //     medications: drugs,
            //     needs_review,
            //     patient:  data.patient || null,
            //     doctor:   data.doctor  || null,
            //     hospital: data.clinic  || null,
            //     date:     rxDate,
            //     diseases: diagnosis ? [diagnosis] : [],
            //     tests:    rxTests,
            //     notes:    rxNotes,
            //     followUp: rxFollowUp,
            //     models_used,
            //     vlm_available: true,
            // });

        } catch (error) {
            console.error('[Prescription] Analysis error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };

    getPrescriptionHistory = async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const isUUID = UUID_RE.test(String(userId));
            const whereClause = isUUID
                ? 'WHERE patient_id = $1'
                : 'WHERE user_id = $1';
            const param = isUUID ? userId : parseInt(userId);

            const limit  = Math.min(parseInt(req.query.limit  || '50'), 100);
            const offset = Math.max(parseInt(req.query.offset || '0'), 0);

            const result = await this.db.query_executor(
                `SELECT scan_id, image_url, doctor_name, doctor_specialty, doctor_qualification,
                        hospital_name, patient_name_rx, patient_json,
                        rx_date, diseases, tests, medications,
                        notes, follow_up, confidence, models_used, created_at
                 FROM prescription_scan
                 ${whereClause}
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [param, limit, offset]
            );

            return res.status(200).json({
                success: true,
                scans:   result.rows,
                total:   result.rowCount,
            });
        } catch (error) {
            console.error('[Prescription] History error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
}

module.exports = PrescriptionController;
