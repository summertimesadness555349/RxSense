const DoctorModel = require('../models/doctorModel.js');

/**
 * Extracts and parses JSON from the text, handling markdown blocks if present.
 */
function extractJSON(text) {
    if (!text) return null;
    let cleaned = text.trim();
    // Check if wrapped in markdown code blocks
    const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
        cleaned = match[1];
    }
    try {
        return JSON.parse(cleaned.trim());
    } catch (e) {
        console.error("Failed to parse JSON directly. Attempting custom cleaning. Original text:", text);
        // Fallback: try to find the first '{' and last '}'
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(cleaned.substring(start, end + 1).trim());
            } catch (err) {
                console.error("Secondary JSON parsing attempt failed:", err);
            }
        }
        throw e;
    }
}

class LLMUtils {
    constructor() {
        // Initialize doctor model for DB interactions (logs, caches)
        this.doctorModel = new DoctorModel();

        // Claude API Configuration
        this.claudeApiKey = process.env.CLAUDE_API_KEY;
        this.claudeModelName = 'claude-sonnet-4-6';
        this.claudeEndpoint = 'https://api.anthropic.com/v1/messages';
    }

    /**
     * Perform the drug cross-over and allergy checks using Claude (two parallel calls).
     * @param {string} patientId - UUID of the patient
     * @param {Array} allergies - Patient's allergies from patient_allergy table
     * @param {Array} currentMedications - Active prescriptions from prescription_item joined with drug
     * @param {Array} proposedMedications - Array of { drug_id, generic_name, brand_name, drug_class }
     * @param {Array} surgeries - Patient's surgery history from patient_surgery table
     * @param {Array} vaccinations - Patient's vaccination history from patient_vaccination table
     */
    checkPrescriptionSafety = async (patientId, allergies, currentMedications, proposedMedications, surgeries = [], vaccinations = []) => {
        // Compress patient context with dosages/frequencies included for accurate clinical checks
        const allergyStr = allergies.map(a => `${a.generic_name || a.brand_name || a.drug_class} (severity: ${a.severity || 'moderate'})`).join('; ') || 'None';
        const currentStr = currentMedications.map(m => `${m.generic_name}${m.dosage ? ` ${m.dosage}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join('; ') || 'None';
        const proposedStr = proposedMedications.map(p => `${p.generic_name}${p.dosage ? ` ${p.dosage}` : ''}${p.frequency ? ` ${p.frequency}` : ''}`).join('; ');
        const surgeriesStr = surgeries.map(s => `${s.surgery_name || s.name} (${new Date(s.date || s.performed_at || s.created_at).toLocaleDateString()})`).join('; ') || 'None';
        const vaccinationsStr = vaccinations.map(v => `${v.vaccine_name} (${new Date(v.date || v.administered_at).toLocaleDateString()})`).join('; ') || 'None';

      // Claude Prompt 1 — Drug-drug interactions and dosage analysis
const interactionPrompt = `You are a clinical pharmacologist AI.
Check for drug-drug interactions and dosage issues between active and proposed medications. For dose-dependent conflicts, suggest the minimum safe dose/day. Skip allergy checks.
Active Medications: ${currentStr},Proposed Medications: ${proposedStr}, Surgeries history: ${surgeriesStr}, vaccination history: ${vaccinationsStr}

IMPORTANT: Analyze the Surgeries and Vaccination history provided below. Consider the dates of these events to determine if they still have a clinically significant impact on the patient's body (e.g., recent surgeries may have specific drug contraindications, or vaccines may have interaction windows).
Respond in strict JSON only:
{
  "has_conflict": boolean,
  "warnings": [{
    "type": "drug_interaction",
    "severity": "mild"|"moderate"|"severe"|"critical",
    "drugs_involved": string[],
    "description": string, // <10 words
    "recommendation": string // <20 words; include safe alternative dose/day if contraindicated
  }],
  "summary": string, // <15 words
  
}Return raw JSON only. No markdown, no code fences.`;

// Claude Prompt 2 — Allergies and duplicate therapies
const allergyPrompt = `You are a clinical pharmacologist AI.
Check proposed medications against patient allergies: generic/brand names, drug class matches, and cross-sensitivities. Skip drug-drug interactions.
Allergies: ${allergyStr},Proposed Medications: ${proposedStr}
Respond in strict JSON only:
{
  "has_conflict": boolean,
  "warnings": [{
    "type": "allergy_conflict"|"other_conflict",
    "severity": "mild"|"moderate"|"severe"|"critical",
    "drugs_involved": string[],
    "description": string, // <10 words
    "recommendation": string // <20 words; include safe alternative drug/dose
  }],
  "summary": string, // <15 words
  
}Return raw JSON only. No markdown, no code fences.`;

        const inputContextForLogging = {
            allergies: allergies.map(a => ({ generic_name: a.generic_name, reaction_type: a.reaction_type, severity: a.severity })),
            currentMedications: currentMedications.map(m => ({ generic_name: m.generic_name, dosage: m.dosage, frequency: m.frequency })),
            proposedMedications: proposedMedications.map(p => ({ generic_name: p.generic_name, dosage: p.dosage || 'Standard', frequency: p.frequency || 'As directed' }))
        };

        /**
         * Helper: call Claude with a given prompt and label for logging.
         */
        const callClaude = async (prompt, label) => {
            if (!this.claudeApiKey) {
                console.log(`Claude API key missing. Skipping ${label} call.`);
                return null;
            }
            console.log(`Calling Claude API (${this.claudeModelName}) for ${label}...`);
            const response = await globalThis.fetch(this.claudeEndpoint, {
                method: 'POST',
                headers: {
                    'x-api-key': this.claudeApiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.claudeModelName,
                    max_tokens: 1000,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0.0
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Claude API returned error code ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const rawText = data.content?.[0]?.text;
            if (!rawText) throw new Error(`Claude API returned empty response content for ${label}.`);

            const parsed = extractJSON(rawText);
            const inputTokens = data.usage?.input_tokens || Math.ceil(prompt.length / 4);
            const outputTokens = data.usage?.output_tokens || Math.ceil(rawText.length / 4);
            const tUsed = inputTokens + outputTokens;

            console.log(`[Claude Token Metrics — ${label}] Prompt: ${inputTokens} | Completion: ${outputTokens} | Total: ${tUsed}`);
            return { parsed, tokensUsed: tUsed };
        };

        // Run both Claude calls in parallel
        const [interactionResult, allergyResult] = await Promise.allSettled([
            callClaude(interactionPrompt, 'drug interaction analysis'),
            callClaude(allergyPrompt, 'allergy & other checks')
        ]);

        let interactionData = null;
        let allergyData = null;
        let tokensUsed = 0;
        const modelsUsed = [];

        if (interactionResult.status === 'fulfilled' && interactionResult.value) {
            interactionData = interactionResult.value.parsed;
            tokensUsed += interactionResult.value.tokensUsed;
            modelsUsed.push(`${this.claudeModelName}(interactions)`);
            console.log("Claude drug interaction analysis success.");
        } else {
            const err = interactionResult.status === 'rejected'
                ? interactionResult.reason?.message || interactionResult.reason
                : 'Not configured';
            console.error("Claude drug interaction task failed or skipped:", err);
        }

        if (allergyResult.status === 'fulfilled' && allergyResult.value) {
            allergyData = allergyResult.value.parsed;
            tokensUsed += allergyResult.value.tokensUsed;
            modelsUsed.push(`${this.claudeModelName}(allergies)`);
            console.log("Claude allergy check success.");
        } else {
            const err = allergyResult.status === 'rejected'
                ? allergyResult.reason?.message || allergyResult.reason
                : 'Not configured';
            console.error("Claude allergy task failed or skipped:", err);
        }

        const activeModelUsed = modelsUsed.length > 0 ? modelsUsed.join(' + ') : 'local-fallback';

        let resultJson;

        if (interactionData || allergyData) {
            const warnings = [];
            let has_conflict = false;

            if (interactionData) {
                if (interactionData.warnings && Array.isArray(interactionData.warnings)) {
                    warnings.push(...interactionData.warnings);
                }
                if (interactionData.has_conflict) has_conflict = true;
            }

            if (allergyData) {
                if (allergyData.warnings && Array.isArray(allergyData.warnings)) {
                    warnings.push(...allergyData.warnings);
                }
                if (allergyData.has_conflict) has_conflict = true;
            }

            // Group warning counts for summary
            const drugInteractionsCount = warnings.filter(w => w.type === 'drug_interaction').length;
            const allergyConflictsCount = warnings.filter(w => w.type === 'allergy_conflict').length;
            const otherConflictsCount = warnings.filter(w => w.type === 'other_conflict').length;

            let summary = '';
            if (has_conflict) {
                const parts = [];
                if (drugInteractionsCount > 0) parts.push(`${drugInteractionsCount} drug interaction(s)`);
                if (allergyConflictsCount > 0) parts.push(`${allergyConflictsCount} allergy conflict(s)`);
                if (otherConflictsCount > 0) parts.push(`${otherConflictsCount} other warning(s)`);
                summary = `Safety check completed with: ${parts.join(', ')}. Please review conflicts.`;
            } else {
                summary = "No drug-drug interactions or allergy conflicts detected. Proposed items appear safe.";
            }

            resultJson = {
                has_conflict,
                warnings,
                summary,
                tokens_used: tokensUsed,
                tokensUsed: tokensUsed
            };
        } else {
            // Local fallback when both Claude calls fail or are unconfigured
            console.log("Both Claude calls failed or unconfigured. Using local rule-based safety checker.");
            resultJson = this.performLocalSafetyCheck(inputContextForLogging);
            resultJson.tokens_used = 0;
            resultJson.tokensUsed = 0;
        }

        resultJson.model_used = activeModelUsed;

        // 1. Audit Log in Database
        try {
            await this.doctorModel.logLLMQuery(
                patientId,
                'drug_interaction',
                JSON.stringify(inputContextForLogging),
                resultJson.summary,
                tokensUsed,
                activeModelUsed
            );
        } catch (dbErr) {
            console.error("Failed to write LLM query audit log:", dbErr.message);
        }

        // 2. Cache Drug-to-Drug Interactions in DB
        if (resultJson.has_conflict && resultJson.warnings.length > 0) {
            for (const warning of resultJson.warnings) {
                if (warning.type === 'drug_interaction' && warning.drugs_involved.length >= 2) {
                    try {
                        const drugAName = warning.drugs_involved[0].toLowerCase();
                        const drugBName = warning.drugs_involved[1].toLowerCase();

                        const drugA = (await this.doctorModel.searchDrugs(drugAName))[0];
                        const drugB = (await this.doctorModel.searchDrugs(drugBName))[0];

                        if (drugA && drugB && drugA.drug_id !== drugB.drug_id) {
                            await this.doctorModel.saveDrugInteraction(
                                drugA.drug_id,
                                drugB.drug_id,
                                warning.severity,
                                warning.description,
                                0.95 // Confidence score
                            );
                        }
                    } catch (cacheErr) {
                        console.error("Failed to cache drug interaction:", cacheErr.message);
                    }
                }
            }
        }

        return resultJson;
    };

    /**
     * Local rule-based safety check when Claude API is unavailable or unconfigured.
     */
    performLocalSafetyCheck = (context) => {
        const warnings = [];

        const dangerousPairs = [
            {
                drugs: ['aspirin', 'warfarin'],
                severity: 'severe',
                description: 'Concomitant use of Aspirin and Warfarin increases the risk of serious bleeding, especially gastrointestinal bleeding.',
                recommendation: 'Monitor INR closely, consider alternatives to Aspirin, or use a gastroprotective agent like a PPI.'
            },
            {
                drugs: ['ibuprofen', 'warfarin'],
                severity: 'severe',
                description: 'NSAIDs like Ibuprofen increase antiplatelet activity and risk of GI bleeding when taken with anticoagulants like Warfarin.',
                recommendation: 'Avoid NSAIDs; use Acetaminophen (Paracetamol) for mild pain control under clinical supervision.'
            },
            {
                drugs: ['sildenafil', 'nitroglycerin'],
                severity: 'critical',
                description: 'Co-administration of Nitroglycerin with Sildenafil can cause a severe, life-threatening drop in blood pressure (hypotension).',
                recommendation: 'DO NOT prescribe Nitroglycerin or other nitrates if patient has taken Sildenafil in the last 24-48 hours.'
            },
            {
                drugs: ['spironolactone', 'lisinopril'],
                severity: 'moderate',
                description: 'Both Spironolactone and Lisinopril conserve potassium, increasing the risk of hyperkalemia (high potassium levels).',
                recommendation: 'Regularly monitor serum potassium and renal function if these drugs are taken together.'
            }
        ];

        // Check proposed drugs against allergies
        for (const proposed of context.proposedMedications) {
            const pGeneric = proposed.generic_name.toLowerCase();
            const pBrand = proposed.brand_name ? proposed.brand_name.toLowerCase() : '';
            const pClass = proposed.drug_class ? proposed.drug_class.toLowerCase() : '';

            for (const allergy of context.allergies) {
                const aGeneric = allergy.generic_name.toLowerCase();
                const aBrand = allergy.brand_name ? allergy.brand_name.toLowerCase() : '';
                const aClass = allergy.drug_class ? allergy.drug_class.toLowerCase() : '';

                let match = false;
                let reason = '';

                if (pGeneric && pGeneric === aGeneric) {
                    match = true;
                    reason = `matches the patient's allergy to ${allergy.generic_name}`;
                } else if (pBrand && pBrand === aBrand) {
                    match = true;
                    reason = `matches the patient's allergy to ${allergy.brand_name}`;
                } else if (pClass && pClass === aClass) {
                    match = true;
                    reason = `belongs to the same class (${allergy.drug_class}) as the patient's allergy`;
                } else if (pGeneric.includes(aGeneric) || aGeneric.includes(pGeneric)) {
                    match = true;
                    reason = `is closely related to the patient's allergy to ${allergy.generic_name}`;
                }

                if (match) {
                    warnings.push({
                        type: 'allergy_conflict',
                        severity: allergy.severity || 'severe',
                        drugs_involved: [proposed.generic_name],
                        description: `Safety Alert: Patient is allergic to ${allergy.generic_name || allergy.drug_class} (Reaction: ${allergy.reaction_type || 'unspecified'}). Proposed drug ${proposed.generic_name} ${reason}.`,
                        recommendation: `Discontinue proposed ${proposed.generic_name} and prescribe a medication from a different drug class.`
                    });
                }
            }
        }

        // Check proposed drugs against current medications AND other proposed drugs
        const checkInteractions = (listA, listB, isSelfCheck = false) => {
            for (let i = 0; i < listA.length; i++) {
                const startIdx = isSelfCheck ? i + 1 : 0;
                for (let j = startIdx; j < listB.length; j++) {
                    const drug1 = listA[i].generic_name.toLowerCase();
                    const drug2 = listB[j].generic_name.toLowerCase();

                    if (drug1 === drug2) continue;

                    const match = dangerousPairs.find(pair =>
                        (pair.drugs[0] === drug1 && pair.drugs[1] === drug2) ||
                        (pair.drugs[0] === drug2 && pair.drugs[1] === drug1)
                    );

                    if (match) {
                        warnings.push({
                            type: 'drug_interaction',
                            severity: match.severity,
                            drugs_involved: [listA[i].generic_name, listB[j].generic_name],
                            description: match.description,
                            recommendation: match.recommendation
                        });
                    }
                }
            }
        };

        checkInteractions(context.proposedMedications, context.currentMedications);
        checkInteractions(context.proposedMedications, context.proposedMedications, true);

        const has_conflict = warnings.length > 0;
        const summary = has_conflict
            ? `Safety check completed with ${warnings.length} warning(s). Please review the conflicts before administering or dispensing these drugs.`
            : "No drug-drug interactions or allergy conflicts detected. The proposed prescription items appear safe based on current records.";

        return { has_conflict, warnings, summary };
    };
}

module.exports = LLMUtils;