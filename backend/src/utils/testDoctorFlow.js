const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const DB_Connection = require('../database/db.js');
const DoctorModel = require('../models/doctorModel.js');
const LLMUtils = require('./llmUtils.js');

async function runTest() {
    console.log("=== RXSENSE — CLAUDE LLM SAFETY CHECK TEST ===\n");

    const db = DB_Connection.getInstance();
    const doctorModel = new DoctorModel();
    const llmUtils = new LLMUtils();

    try {
        // 1. Verify DB connection
        const dbCheck = await db.query_executor("SELECT NOW();");
        console.log("✔ DB Connection OK. Server time:", dbCheck.rows[0].now);

        // 2. Verify API key is loaded
        if (!process.env.CLAUDE_API_KEY) {
            throw new Error("CLAUDE_API_KEY is not set in .env — cannot run LLM test.");
        }
        console.log(`✔ CLAUDE_API_KEY loaded (starts with ${process.env.CLAUDE_API_KEY.slice(0, 20)}...)\n`);

        // 3. Ping Claude API
        console.log("--- CLAUDE API CONNECTIVITY CHECK ---");
        const pingResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 16,
                messages: [{ role: 'user', content: 'Reply with the word PONG only.' }],
                temperature: 0.0
            })
        });

        if (!pingResponse.ok) {
            const err = await pingResponse.text();
            throw new Error(`Claude API ping failed — HTTP ${pingResponse.status}: ${err}`);
        }
        const pingData = await pingResponse.json();
        console.log(`✔ Claude API reachable. Replied: "${pingData.content?.[0]?.text?.trim()}"\n`);

        // 4. Fetch real patient data from DB
        const patientId = (await db.query_executor(
            "SELECT patient_id FROM patient WHERE username = 'patient_alice_test' LIMIT 1;"
        )).rows[0]?.patient_id;

        if (!patientId) throw new Error("Test patient not found. Run the full seeding test first.");

        // Comprehensive mock patient data (10 allergies, 15 active medications, 3 proposed medications)
        const allergies = [
            { generic_name: 'Penicillin', reaction_type: 'rash', severity: 'moderate', drug_class: 'Penicillin Antibiotics' },
            { generic_name: 'Sulfa drugs', reaction_type: 'hives', severity: 'mild', drug_class: 'Sulfonamides' },
            { generic_name: 'Aspirin', reaction_type: 'bronchospasm', severity: 'severe', drug_class: 'NSAID' },
            { generic_name: 'Codeine', reaction_type: 'nausea', severity: 'mild', drug_class: 'Opioids' },
            { generic_name: 'Erythromycin', reaction_type: 'GI upset', severity: 'mild', drug_class: 'Macrolides' },
            { generic_name: 'Ciprofloxacin', reaction_type: 'tendonitis', severity: 'moderate', drug_class: 'Fluoroquinolones' },
            { generic_name: 'Lidocaine', reaction_type: 'swelling', severity: 'mild', drug_class: 'Local Anesthetics' },
            { generic_name: 'Peanuts', reaction_type: 'anaphylaxis', severity: 'critical', drug_class: 'Food' },
            { generic_name: 'Contrast dye', reaction_type: 'rash', severity: 'moderate', drug_class: 'Diagnostic agents' },
            { generic_name: 'Tetanus vaccine', reaction_type: 'fever', severity: 'mild', drug_class: 'Vaccines' }
        ];

        const currentMedications = [
            { generic_name: 'Atorvastatin', dosage: '20mg', frequency: 'Daily' },
            { generic_name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' },
            { generic_name: 'Levothyroxine', dosage: '100mcg', frequency: 'Daily' },
            { generic_name: 'Amlodipine', dosage: '5mg', frequency: 'Daily' },
            { generic_name: 'Omeprazole', dosage: '20mg', frequency: 'Daily' },
            { generic_name: 'Gabapentin', dosage: '300mg', frequency: 'Three times daily' },
            { generic_name: 'Albuterol', dosage: '90mcg', frequency: 'As needed' },
            { generic_name: 'Metoprolol', dosage: '50mg', frequency: 'Daily' },
            { generic_name: 'Sertraline', dosage: '50mg', frequency: 'Daily' },
            { generic_name: 'Losartan', dosage: '50mg', frequency: 'Daily' },
            { generic_name: 'Warfarin', dosage: '5mg', frequency: 'Daily' },
            { generic_name: 'Furosemide', dosage: '40mg', frequency: 'Daily' },
            { generic_name: 'Spironolactone', dosage: '25mg', frequency: 'Daily' },
            { generic_name: 'Acetaminophen', dosage: '500mg', frequency: 'As needed' },
            { generic_name: 'Atropine', dosage: '0.5mg', frequency: 'As directed' }
        ];

        const proposedMedications = [
            { drug_id: '44444444-4444-4444-4444-444444444444', generic_name: 'Lisinopril', brand_name: 'Prinivil', drug_class: 'ACE Inhibitor', dosage: '10mg', frequency: 'Daily' },
            { drug_id: '55555555-5555-5555-5555-555555555555', generic_name: 'Ibuprofen', brand_name: 'Advil', drug_class: 'NSAID', dosage: '800mg', frequency: 'Three times daily' },
            { drug_id: '66666666-6666-6666-6666-666666666666', generic_name: 'Amoxicillin', brand_name: 'Amoxil', drug_class: 'Penicillin Antibiotic', dosage: '500mg', frequency: 'Three times daily' }
        ];

        console.log("--- SAFETY CHECK INPUT ---");
        console.log("Patient Allergies:     ", allergies.map(a => a.generic_name));
        console.log("Active Medications:   ", currentMedications.map(m => m.generic_name));
        console.log("Proposed Medications: ", proposedMedications.map(p => p.generic_name));
        console.log("--------------------------\n");

        // 5. Run LLM safety check
        console.log("Calling Claude prescription safety check (two parallel calls)...");
        const safetyReport = await llmUtils.checkPrescriptionSafety(
            patientId,
            allergies,
            currentMedications,
            proposedMedications
        );

        // 6. Print safety report
        console.log("\n=== SAFETY REPORT ===");
        console.log("Models Used: ", safetyReport.model_used);
        console.log("Tokens Used: ", safetyReport.tokensUsed || 0);
        console.log("Has Conflict:", safetyReport.has_conflict);
        console.log("Summary:     ", safetyReport.summary);
        console.log("\nWarnings:");
        if (safetyReport.warnings && Array.isArray(safetyReport.warnings)) {
            safetyReport.warnings.forEach((w, i) => {
                console.log(`\n  [#${i + 1}] ${w.type.toUpperCase()} — Severity: ${w.severity}`);
                console.log(`  Drugs Involved:  `, w.drugs_involved);
                console.log(`  Description:     `, w.description);
                console.log(`  Recommendation:  `, w.recommendation);
            });
        } else {
            console.log("  No warnings present.");
        }
        console.log("\n=====================");

    } catch (error) {
        console.error("\n✘ Test FAILED:", error.message);
    } finally {
        await db.pool.end();
    }
}

runTest();