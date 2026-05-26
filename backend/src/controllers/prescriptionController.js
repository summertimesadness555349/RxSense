const { matchAllTokens } = require('../utils/drugMatcher.js');

const PRESCRIPTO_URL    = 'https://www.prescriptoai.com/api/v1/prescription/extract';
const PRESCRIPTO_API_KEY = process.env.PRESCRIPTO_API_KEY;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL;

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

class PrescriptionController {
    analyzePrescription = async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'Image file required' });
            }

            if (!PRESCRIPTO_API_KEY) {
                return res.status(500).json({ success: false, error: 'PRESCRIPTO_API_KEY not configured' });
            }

            console.log(`[Prescription] Received: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

            // 1. Call PrescriptoAI
            console.log(`[Prescription] Calling PrescriptoAI...`);
            const t0 = Date.now();
            const data = await callPrescriptoAI(req.file.buffer, req.file.mimetype, req.file.originalname);

            console.log(`\n── PrescriptoAI Output (${((Date.now() - t0) / 1000).toFixed(1)}s) ────────────────────`);
            console.log(JSON.stringify(data, null, 2));
            console.log(`─────────────────────────────────────────────────────────────────\n`);

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
                return res.status(200).json({
                    success: true,
                    drugs: [],
                    needs_review: [],
                    patient:  data.patient || null,
                    doctor:   data.doctor  || null,
                    hospital: data.clinic  || null,
                    date:     rxDate,
                    diseases: diagnosis ? [diagnosis] : [],
                    tests:    rxTests,
                    notes:    rxNotes,
                    followUp: rxFollowUp,
                    models_used: ['prescriptoai'],
                    message: 'No medications detected',
                });
            }

            // 3. Fuzzy match + MedGemma dosages in parallel
            console.log(`[Prescription] Fuzzy match + MedGemma dosage extraction (parallel)...`);
            const t1 = Date.now();

            const [candidates, medGemmaDosages] = await Promise.all([
                matchAllTokens(tokens),
                callMedGemmaDosages(req.file.buffer, req.file.mimetype, req.file.originalname, tokens),
            ]);

            console.log(`[Prescription] Parallel calls done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);

            // Index MedGemma results by lowercased name for fast lookup
            const dosageMap = {};
            for (const d of medGemmaDosages) {
                if (d.name) dosageMap[d.name.toLowerCase()] = d;
            }

            console.log(`\n── Fuzzy Match Results ───────────────────────────────────────────`);
            for (const [token, matches] of Object.entries(candidates)) {
                if (matches.length === 0) {
                    console.log(`  "${token}" → no matches`);
                } else {
                    const top = matches[0];
                    const sim = Math.max(top.brand_sim ?? 0, top.generic_sim ?? 0).toFixed(2);
                    console.log(`  "${token}" → ${top.brand} (${top.generic || '?'}) ${top.strength || ''} sim=${sim}`);
                }
            }
            if (medGemmaDosages.length) {
                console.log(`\n── MedGemma Dosage Output ────────────────────────────────────────`);
                medGemmaDosages.forEach(d => {
                    console.log(`  ${d.name}: dosage=${d.dosage || '?'} freq=${d.frequency || '?'} duration=${d.duration || '?'}`);
                });
            }
            console.log(`─────────────────────────────────────────────────────────────────\n`);

            // 4. Build final drugs list
            //    Priority: MedGemma dosage > PrescriptoAI dosage (MedGemma sees the actual image)
            const drugs = medications.map(med => {
                const name      = (med.name || '').trim();
                const topMatch  = candidates[name]?.[0];
                const sim       = topMatch ? Math.max(topMatch.brand_sim ?? 0, topMatch.generic_sim ?? 0) : 0;
                const gemma     = dosageMap[name.toLowerCase()] || {};

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

            console.log(`[Prescription] Done — ${drugs.length} drug(s), ${needs_review.length} need review, models: ${models_used.join('+')}`);

            return res.status(200).json({
                success: true,
                drugs,
                needs_review,
                patient:  data.patient || null,
                doctor:   data.doctor  || null,
                hospital: data.clinic  || null,
                date:     rxDate,
                diseases: diagnosis ? [diagnosis] : [],
                tests:    rxTests,
                notes:    rxNotes,
                followUp: rxFollowUp,
                models_used,
                vlm_available: true,
            });

        } catch (error) {
            console.error('Prescription analysis error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    };
}

module.exports = PrescriptionController;
