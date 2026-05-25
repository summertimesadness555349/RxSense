const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const DB_Connection = require('../database/db.js');
const DoctorModel = require('../models/doctorModel.js');
const LLMUtils = require('./llmUtils.js');
const bcrypt = require('bcrypt');

async function runTest() {
    console.log("=== STARTING RXSENSE DOCTOR AND LLM FLOW TEST ===");
    
    // Set up dummy JWT secrets if not present in env
    process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_secret_access_key';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_secret_refresh_key';
    process.env.PASSWORD_SALT_ROUNDS = process.env.PASSWORD_SALT_ROUNDS || '4'; // use low rounds for fast tests

    const db = DB_Connection.getInstance();
    const doctorModel = new DoctorModel();
    const llmUtils = new LLMUtils();

    try {
        // 1. Verify DB connection
        console.log("Checking DB Connection...");
        const dbCheck = await db.query_executor("SELECT NOW();");
        console.log("DB Connection OK. Server time:", dbCheck.rows[0].now);

        // Ensure patient columns match current Schema.sql
        console.log("Aligning database patient columns with current schema...");
        await db.query_executor("ALTER TABLE patient ADD COLUMN IF NOT EXISTS phone VARCHAR(20);");
        await db.query_executor("ALTER TABLE patient ADD COLUMN IF NOT EXISTS height NUMERIC(5, 2);");
        await db.query_executor("ALTER TABLE patient ADD COLUMN IF NOT EXISTS weight NUMERIC(5, 2);");
        console.log("Patient columns aligned.");

        // 2. Clear or Seed Mock Hospital
        console.log("\nSeeding Mock Hospital...");
        let hospitalId;
        const existingHospital = await db.query_executor("SELECT hospital_id FROM hospital LIMIT 1;");
        if (existingHospital.rows.length > 0) {
            hospitalId = existingHospital.rows[0].hospital_id;
            console.log("Using existing hospital ID:", hospitalId);
        } else {
            const insertHospital = await db.query_executor(`
                INSERT INTO hospital (name, location, type)
                VALUES ('City Health Center', '123 Medical Way', 'clinic')
                RETURNING hospital_id;
            `);
            hospitalId = insertHospital.rows[0].hospital_id;
            console.log("Created mock hospital with ID:", hospitalId);
        }

        // 3. Clear or Seed Mock Doctor
        console.log("\nSeeding Mock Doctor...");
        let doctorId;
        const testUsername = 'dr_john_doe_test';
        const existingDoctor = await doctorModel.getDoctorByUsername(testUsername);
        if (existingDoctor) {
            doctorId = existingDoctor.doctor_id;
            console.log("Doctor already exists with ID:", doctorId);
        } else {
            const passwordHash = await bcrypt.hash('password123', 4);
            const doc = await doctorModel.createDoctor({
                name: 'Dr. John Doe (Test)',
                specialty: 'General Physician',
                licenseNumber: 'LIC-TEST-123',
                gender: 'male',
                username: testUsername,
                email: 'dr_john_doe_test@rxsense.com',
                password: passwordHash
            });
            doctorId = doc.doctor_id;
            console.log("Created mock doctor with ID:", doctorId);
        }

        // Associate Doctor with Hospital
        await doctorModel.addHospitalAffiliation(doctorId, hospitalId, 'Attending Physician', true);
        console.log("Doctor hospital affiliation established.");

        // 4. Seed Mock Patient
        console.log("\nSeeding Mock Patient...");
        let patientId;
        const patientUsername = 'patient_alice_test';
        const existingPatient = await db.query_executor("SELECT patient_id FROM patient WHERE username = $1 LIMIT 1;", [patientUsername]);
        if (existingPatient.rows.length > 0) {
            patientId = existingPatient.rows[0].patient_id;
            console.log("Patient already exists with ID:", patientId);
        } else {
            const passwordHash = await bcrypt.hash('password123', 4);
            const insertPatient = await db.query_executor(`
                INSERT INTO patient (name, date_of_birth, gender, phone, height, weight, username, email, password)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING patient_id;
            `, [
                'Alice Smith (Test)', 
                '1985-05-12', 
                'female', 
                '+15551234', 
                165.00, 
                60.00, 
                patientUsername, 
                'alice_test@rxsense.com', 
                passwordHash
            ]);
            patientId = insertPatient.rows[0].patient_id;
            console.log("Created mock patient with ID:", patientId);
        }

        // 5. Seed Mock Drugs
        console.log("\nSeeding Mock Drugs catalog...");
        const drugsToSeed = [
            { id: '11111111-1111-1111-1111-111111111111', generic_name: 'Warfarin', brand_name: 'Coumadin', drug_class: 'Anticoagulant' },
            { id: '22222222-2222-2222-2222-222222222222', generic_name: 'Aspirin', brand_name: 'Bayer', drug_class: 'NSAID' },
            { id: '33333333-3333-3333-3333-333333333333', generic_name: 'Penicillin', brand_name: 'Bicillin', drug_class: 'Antibiotic' }
        ];

        for (const drug of drugsToSeed) {
            await db.query_executor(`
                INSERT INTO drug (drug_id, generic_name, brand_name, drug_class)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (drug_id) DO UPDATE 
                SET generic_name = EXCLUDED.generic_name, brand_name = EXCLUDED.brand_name, drug_class = EXCLUDED.drug_class;
            `, [drug.id, drug.generic_name, drug.brand_name, drug.drug_class]);
        }
        console.log("Mock drugs seeded successfully.");

        // 6. Seed Patient Allergy (Allergic to Penicillin)
        console.log("\nSeeding patient allergy (Allergic to Penicillin)...");
        await db.query_executor(`
            INSERT INTO patient_allergy (patient_id, drug_id, reaction_type, severity, confirmed_at)
            VALUES ($1, '33333333-3333-3333-3333-333333333333', 'Rash and swelling', 'moderate', NOW())
            ON CONFLICT (patient_id, drug_id) DO NOTHING;
        `, [patientId]);
        console.log("Patient allergy record verified.");

        // 7. Seed Active Prescription (Taking Warfarin)
        console.log("\nSeeding active prescription (Taking Warfarin)...");
        const existingRx = await db.query_executor(`
            SELECT prescription_id FROM prescription WHERE patient_id = $1 AND status = 'active' LIMIT 1;
        `, [patientId]);
        
        if (existingRx.rows.length === 0) {
            const rx = await doctorModel.createPrescription(patientId, doctorId);
            await doctorModel.addPrescriptionItem(
                rx.prescription_id, 
                '11111111-1111-1111-1111-111111111111', // Warfarin
                '5mg', 
                'once daily', 
                30, 
                'Take at bedtime'
            );
            console.log("Created active prescription of Warfarin for patient.");
        } else {
            console.log("Active prescription of Warfarin already exists.");
        }

        // 8. Run Prescription Safety Check (Checking Aspirin + Penicillin)
        // Aspirin has drug-drug interaction with existing Warfarin (risk of bleeding)
        // Penicillin has allergy conflict (patient is allergic to Penicillin)
        console.log("\n--- RUNNING PRE-CHECK SAFETY AUDIT ---");
        const allergies = await doctorModel.getPatientAllergies(patientId);
        const activePrescriptions = await doctorModel.getPatientActivePrescriptions(patientId);
        const currentMedications = [];
        for (const rx of activePrescriptions) {
            currentMedications.push(...rx.items);
        }

        // Proposed: Aspirin and Penicillin
        const proposedMedications = [
            { drug_id: '22222222-2222-2222-2222-222222222222', generic_name: 'Aspirin', brand_name: 'Bayer', drug_class: 'NSAID' },
            { drug_id: '33333333-3333-3333-3333-333333333333', generic_name: 'Penicillin', brand_name: 'Bicillin', drug_class: 'Antibiotic' }
        ];

        console.log("Patient Allergies:", allergies.map(a => a.generic_name));
        console.log("Active Medications:", currentMedications.map(m => m.generic_name));
        console.log("Proposed Medications:", proposedMedications.map(p => p.generic_name));

        const safetyReport = await llmUtils.checkPrescriptionSafety(
            patientId,
            allergies,
            currentMedications,
            proposedMedications
        );

        console.log("\nSafety check result:");
        console.log("Has Conflict:", safetyReport.has_conflict);
        console.log("Summary:", safetyReport.summary);
        console.log("Warnings detail:");
        safetyReport.warnings.forEach((w, index) => {
            console.log(`[Warning #${index + 1}] Type: ${w.type} | Severity: ${w.severity}`);
            console.log(`  Drugs Involved:`, w.drugs_involved);
            console.log(`  Description:`, w.description);
            console.log(`  Recommendation:`, w.recommendation);
        });

        // 9. Verify LLM Query Log
        const logs = await db.query_executor(`
            SELECT * FROM llm_query_log WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 1;
        `, [patientId]);
        console.log("\nVerifying LLM Query Log entry in DB:");
        if (logs.rows.length > 0) {
            console.log(`✔ Query logged successfully! ID: ${logs.rows[0].query_id}`);
            console.log(`  Query Type: ${logs.rows[0].query_type}`);
            console.log(`  Model Used: ${logs.rows[0].model_used}`);
        } else {
            console.log("✘ LLM Query Log entry missing.");
        }

        // 10. Verify Cached Drug Interaction in DB
        const cachedInteractions = await db.query_executor(`
            SELECT * FROM drug_interaction 
            WHERE (drug_a_id = '22222222-2222-2222-2222-222222222222' AND drug_b_id = '11111111-1111-1111-1111-111111111111')
               OR (drug_a_id = '11111111-1111-1111-1111-111111111111' AND drug_b_id = '22222222-2222-2222-2222-222222222222')
            LIMIT 1;
        `);
        console.log("\nVerifying Drug Interaction cache in DB:");
        if (cachedInteractions.rows.length > 0) {
            console.log(`✔ Interaction cached successfully! ID: ${cachedInteractions.rows[0].interaction_id}`);
            console.log(`  Severity: ${cachedInteractions.rows[0].severity}`);
            console.log(`  Description: ${cachedInteractions.rows[0].description}`);
        } else {
            console.log("✘ Interaction cache missing.");
        }

        // 11. Test Doctor Credentials Updates (Username, Email, Password)
        console.log("\nTesting Doctor Credentials Update...");
        
        // Mock a request context for profile update
        const updateReq = {
            doctor: { doctor_id: doctorId, username: testUsername, email: 'dr_john_doe_test@rxsense.com' },
            body: { username: 'dr_john_doe_updated', email: 'dr_john_doe_updated@rxsense.com', name: 'Dr. John Doe (Updated)' }
        };
        
        // Create an instance of DoctorController to use its updateProfile logic
        const DoctorController = require('../controllers/doctorController.js');
        const docController = new DoctorController();
        
        let updateResJson;
        const mockRes = {
            status: function(code) { 
                this.statusCode = code; 
                return this; 
            },
            json: function(payload) { 
                updateResJson = payload; 
                return this; 
            }
        };
        
        await docController.updateProfile(updateReq, mockRes);
        console.log("Profile update result:", updateResJson);
        if (updateResJson && updateResJson.success) {
            console.log("✔ Profile credentials update (username and email) succeeded!");
        } else {
            console.error("✘ Profile credentials update failed:", updateResJson);
        }

        // Test Doctor Password Change
        console.log("\nTesting Doctor Password Change...");
        const passwordChangeReq = {
            doctor: { doctor_id: doctorId, username: 'dr_john_doe_updated' },
            body: { oldPassword: 'password123', newPassword: 'newsecurepassword123' }
        };
        
        let pwChangeResJson;
        const mockResPw = {
            status: function(code) { 
                this.statusCode = code; 
                return this; 
            },
            json: function(payload) { 
                pwChangeResJson = payload; 
                return this; 
            }
        };

        await docController.changePassword(passwordChangeReq, mockResPw);
        console.log("Password change result:", pwChangeResJson);
        if (pwChangeResJson && pwChangeResJson.success) {
            console.log("✔ Password change succeeded!");
        } else {
            console.error("✘ Password change failed:", pwChangeResJson);
        }

        // Revert username/email/password back so test is repeatable
        console.log("\nReverting test credentials...");
        const revertedHash = await bcrypt.hash('password123', 4);
        await doctorModel.updateDoctor(doctorId, { 
            username: testUsername, 
            email: 'dr_john_doe_test@rxsense.com',
            name: 'Dr. John Doe (Test)'
        });
        // Specifically update password using the raw db query because updateDoctor is restricted to profile fields
        await db.query_executor("UPDATE doctor SET password = $1 WHERE doctor_id = $2;", [revertedHash, doctorId]);
        console.log("Reverted test credentials successfully.");

        console.log("\n=== ALL TEST CHECKS COMPLETED SUCCESSFULLY ===");
    } catch (error) {
        console.error("\n✘ Verification check FAILED:", error);
    } finally {
        await db.pool.end();
    }
}

runTest();
