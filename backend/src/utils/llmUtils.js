const DoctorModel = require('../models/doctorModel.js');

class LLMUtils {
    constructor() {
        // Initialize doctor model for DB interactions (logs, caches)
        this.doctorModel = new DoctorModel();
        this.apiKey = process.env.GEMINI_API_KEY;
        // Use gemini-2.5-flash for safety checks
        this.modelName = 'gemini-2.5-flash';
        this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent`;
    }

    /**
     * Perform the drug cross-over and allergy checks using LLM or local fallback.
     * 
     * @param {string} patientId - UUID of the patient
     * @param {Array} allergies - Patient's allergies from patient_allergy table
     * @param {Array} currentMedications - Active prescriptions from prescription_item joined with drug
     * @param {Array} proposedMedications - Array of { drug_id, generic_name, brand_name, drug_class }
     */
    checkPrescriptionSafety = async (patientId, allergies, currentMedications, proposedMedications) => {
        const inputContext = {
            allergies: allergies.map(a => ({
                generic_name: a.generic_name,
                brand_name: a.brand_name,
                drug_class: a.drug_class,
                reaction_type: a.reaction_type,
                severity: a.severity
            })),
            currentMedications: currentMedications.map(m => ({
                generic_name: m.generic_name,
                brand_name: m.brand_name,
                drug_class: m.drug_class,
                dosage: m.dosage,
                frequency: m.frequency
            })),
            proposedMedications: proposedMedications.map(p => ({
                generic_name: p.generic_name,
                brand_name: p.brand_name,
                drug_class: p.drug_class,
                dosage: p.dosage || 'Standard',
                frequency: p.frequency || 'As directed'
            }))
        };

        const prompt = `
You are a highly advanced clinical pharmacologist AI assistant integrated into a hospital management system.
Analyze the proposed medications for potential safety risks:
1. **Allergy Conflict**: Check if any proposed medications (by generic name, brand name, or drug class) conflict with the patient's existing drug allergies. Look for cross-sensitivities (e.g., penicillin allergy and cephalosporins).
2. **Drug-to-Drug Interaction (Cross-over)**: Check for potential drug interactions between the proposed medications and the patient's current medications, or between the proposed medications themselves.

Below is the patient clinical context:
- Patient Allergies:
${JSON.stringify(inputContext.allergies, null, 2)}

- Current Active Medications:
${JSON.stringify(inputContext.currentMedications, null, 2)}

- Proposed Medications to Prescribe:
${JSON.stringify(inputContext.proposedMedications, null, 2)}

Provide a safety review in JSON format. The response must follow this schema exactly:
{
  "has_conflict": boolean, // true if any allergy or drug-drug interaction warning is found
  "warnings": [
    {
      "type": "drug_interaction" | "allergy_conflict",
      "severity": "mild" | "moderate" | "severe" | "critical",
      "drugs_involved": string[], // names of the drugs involved (e.g. ["Aspirin", "Warfarin"])
      "description": string, // clear details explaining why this is a risk
      "recommendation": string // clinical recommendation (e.g., alternative drugs or adjustment)
    }
  ],
  "summary": string // overall summary of the safety check result
}
Return ONLY valid JSON. Do not include markdown code block formatting like \`\`\`json.
`;

        let resultJson;
        let apiCallSuccessful = false;
        let tokensUsed = 0;

        if (this.apiKey) {
            try {
                console.log("Calling Gemini API for safety check...");
                const response = await globalThis.fetch(`${this.endpoint}?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }],
                        generationConfig: {
                            responseMimeType: "application/json",
                            temperature: 0.1
                        }
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (rawText) {
                        resultJson = JSON.parse(rawText.trim());
                        apiCallSuccessful = true;
                        // Approximate tokens used
                        tokensUsed = Math.ceil((prompt.length + rawText.length) / 4);
                    }
                } else {
                    const errText = await response.text();
                    console.error(`Gemini API returned error code ${response.status}:`, errText);
                }
            } catch (err) {
                console.error("Failed to connect to Gemini API, falling back to local checker:", err.message);
            }
        } else {
            console.log("No GEMINI_API_KEY found in environment variables. Using local rule-based safety checker.");
        }

        // Fallback to local rule-based safety checker
        if (!apiCallSuccessful) {
            resultJson = this.performLocalSafetyCheck(inputContext);
        }

        // 1. Audit Log in Database
        try {
            await this.doctorModel.logLLMQuery(
                patientId,
                'drug_interaction',
                JSON.stringify(inputContext),
                resultJson.summary,
                tokensUsed
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

                        // Try to find the matching drug UUIDs from our catalog
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
     * Local rule-based safety check when Gemini API is unavailable or unconfigured.
     */
    performLocalSafetyCheck = (context) => {
        const warnings = [];

        // Simple lookup of known dangerous drug combinations (generic name matches)
        // e.g. Aspirin + Warfarin (Severe bleeding risk)
        // e.g. Sildenafil + Nitroglycerin (Critical hypotension risk)
        // e.g. Ibuprofen + Warfarin (Severe GI bleeding risk)
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

        // All drugs currently active or proposed
        const allDrugs = [...context.currentMedications, ...context.proposedMedications];

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
                    // partial match
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

                    // Search match in dangerousPairs
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

        // 1. Proposed vs Current
        checkInteractions(context.proposedMedications, context.currentMedications);
        // 2. Proposed vs Proposed (cross-interactions within the new prescription)
        checkInteractions(context.proposedMedications, context.proposedMedications, true);

        // TODO: Future developers can expand the dangerousPairs database or improve local heuristic matching

        const has_conflict = warnings.length > 0;
        const summary = has_conflict 
            ? `Safety check completed with ${warnings.length} warning(s). Please review the conflicts before administering or dispensing these drugs.`
            : "No drug-drug interactions or allergy conflicts detected. The proposed prescription items appear safe based on current records.";

        return {
            has_conflict,
            warnings,
            summary
        };
    };
}

module.exports = LLMUtils;
