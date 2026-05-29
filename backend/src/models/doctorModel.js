const DB_Connection = require('../database/db.js');

class DoctorModel {
    constructor() {
        this.db_connection = new DB_Connection();
    }

    createDoctor = async (doctorData) => {
        try {
            const { name, specialty, licenseNumber, gender, username, email, password } = doctorData;
            
            // Ensure specialty is stored as an array of strings in PostgreSQL
            let specialtyArray = [];
            if (Array.isArray(specialty)) {
                specialtyArray = specialty;
            } else if (typeof specialty === 'string') {
                specialtyArray = specialty.split(',').map(s => s.trim()).filter(Boolean);
            }

            const query = `
                INSERT INTO doctor (name, specialty, license_number, gender, username, email, password)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING doctor_id, name, specialty, license_number, gender, username, email, created_at, updated_at;
            `;
            const params = [name, specialtyArray, licenseNumber, gender, username, email, password];
            const result = await this.db_connection.query_executor(query, params);
            return result.rows[0];
        } catch (error) {
            console.error(`Doctor insertion failed: ${error.message}`);
            throw error;
        }
    };

    getDoctorById = async (doctorId) => {
        try {
            const query = `
                SELECT doctor_id, name, specialty, license_number, gender, username, email, last_login, created_at, updated_at
                FROM doctor
                WHERE doctor_id = $1
                LIMIT 1;
            `;
            const result = await this.db_connection.query_executor(query, [doctorId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Finding doctor by id failed: ${error.message}`);
            throw error;
        }
    };

    getDoctorByEmail = async (email) => {
        try {
            const query = `
                SELECT * FROM doctor WHERE email = $1 LIMIT 1;
            `;
            const result = await this.db_connection.query_executor(query, [email]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Finding doctor by email failed: ${error.message}`);
            throw error;
        }
    };

    getDoctorByUsername = async (username) => {
        try {
            const query = `
                SELECT * FROM doctor WHERE username = $1 LIMIT 1;
            `;
            const result = await this.db_connection.query_executor(query, [username]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Finding doctor by username failed: ${error.message}`);
            throw error;
        }
    };

    getDoctorByLicenseNumber = async (licenseNumber) => {
        try {
            const query = `
                SELECT * FROM doctor WHERE license_number = $1 LIMIT 1;
            `;
            const result = await this.db_connection.query_executor(query, [licenseNumber]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Finding doctor by license number failed: ${error.message}`);
            throw error;
        }
    };

    updateDoctor = async (doctorId, updates) => {
        try {
            if (!updates || Object.keys(updates).length === 0) {
                throw new Error("No updates were sent");
            }

            const allowed = new Set(["name", "specialty", "gender", "username", "email", "password"]);
            const sets = [];
            const values = [];
            let idx = 1;

            for (let [key, value] of Object.entries(updates)) {
                if (!allowed.has(key)) continue;
                
                if (key === 'specialty') {
                    if (Array.isArray(value)) {
                        // Value is already an array
                    } else if (typeof value === 'string') {
                        value = value.split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        value = [];
                    }
                }
                
                sets.push(`${key} = $${idx++}`);
                values.push(value);
            }

            if (sets.length === 0) {
                throw new Error("No valid updates provided");
            }

            sets.push(`updated_at = NOW()`);
            values.push(doctorId);

            const query = `
                UPDATE doctor
                SET ${sets.join(', ')}
                WHERE doctor_id = $${idx}
                RETURNING doctor_id, name, specialty, license_number, gender, username, email, created_at, updated_at;
            `;
            const result = await this.db_connection.query_executor(query, values);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Doctor update failed: ${error.message}`);
            throw error;
        }
    };

    setLastLogin = async (doctorId) => {
        try {
            const query = `
                UPDATE doctor
                SET last_login = NOW()
                WHERE doctor_id = $1
                RETURNING doctor_id;
            `;
            await this.db_connection.query_executor(query, [doctorId]);
        } catch (error) {
            console.error(`Recording doctor last login failed: ${error.message}`);
        }
    };

    // Hospital Affiliation
    addHospitalAffiliation = async (doctorId, hospitalId, role, isPrimary = false) => {
        try {
            const query = `
                INSERT INTO doctor_hospital (doctor_id, hospital_id, role, is_primary)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (doctor_id, hospital_id) 
                DO UPDATE SET role = EXCLUDED.role, is_primary = EXCLUDED.is_primary
                RETURNING *;
            `;
            // Note: Schema doesn't have updated_at in doctor_hospital. Let's check Schema.sql doctor_hospital columns.
            // g:\Hackathon\RxSense\backend\src\database\Schema.sql lines 126-135:
            // CREATE TABLE doctor_hospital (
            //   id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
            //   doctor_id    UUID    NOT NULL REFERENCES doctor(doctor_id)   ON DELETE CASCADE,
            //   hospital_id  UUID    NOT NULL REFERENCES hospital(hospital_id) ON DELETE CASCADE,
            //   role         VARCHAR(80),
            //   is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
            //   start_date   DATE    NOT NULL DEFAULT CURRENT_DATE,
            //   end_date     DATE,
            //   UNIQUE (doctor_id, hospital_id)
            // );
            // No updated_at. Let's remove it to avoid errors.
            const queryFix = `
                INSERT INTO doctor_hospital (doctor_id, hospital_id, role, is_primary)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (doctor_id, hospital_id) 
                DO UPDATE SET role = EXCLUDED.role, is_primary = EXCLUDED.is_primary
                RETURNING *;
            `;
            const result = await this.db_connection.query_executor(queryFix, [doctorId, hospitalId, role, isPrimary]);
            return result.rows[0];
        } catch (error) {
            console.error(`Failed to add hospital affiliation: ${error.message}`);
            throw error;
        }
    };

    getHospitalAffiliations = async (doctorId) => {
        try {
            const query = `
                SELECT dh.*, h.name as hospital_name, h.location, h.type
                FROM doctor_hospital dh
                JOIN hospital h ON dh.hospital_id = h.hospital_id
                WHERE dh.doctor_id = $1 AND dh.end_date IS NULL;
            `;
            const result = await this.db_connection.query_executor(query, [doctorId]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get hospital affiliations: ${error.message}`);
            throw error;
        }
    };

    // Patient and Clinical Management
    getAllPatients = async () => {
        try {
            const query = `
                SELECT patient_id, name, date_of_birth, gender, phone, height, weight, email, created_at
                FROM patient
                ORDER BY name ASC;
            `;
            const result = await this.db_connection.query_executor(query);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get patients: ${error.message}`);
            throw error;
        }
    };

    getPatientById = async (patientId) => {
        try {
            const query = `
                SELECT patient_id, name, date_of_birth, gender, phone, height, weight, email, 
                       blood_group AS "bloodGroup", smoking_status AS "smokingStatus", 
                       blood_pressure_systolic AS "bloodPressureSystolic", blood_pressure_diastolic AS "bloodPressureDiastolic", bp_recorded_at AS "bpRecordedAt",
                       emergency_contact_name AS "emergencyContactName", emergency_contact_phone AS "emergencyContactPhone", emergency_contact_relation AS "emergencyContactRelation",
                       created_at
                FROM patient
                WHERE patient_id = $1;
            `;
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Failed to find patient: ${error.message}`);
            throw error;
        }
    };

    getPatientConditions = async (patientId) => {
        try {
            const query = `
                SELECT kc.*, d.name as diagnosed_by_name
                FROM known_condition kc
                LEFT JOIN doctor d ON kc.diagnosed_by = d.doctor_id
                WHERE kc.patient_id = $1
                ORDER BY kc.diagnosed_at DESC;
            `;
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get patient conditions: ${error.message}`);
            throw error;
        }
    };

    getPatientSurgeries = async (patientId) => {
        try {
            const query = `
                SELECT sh.*, d.name as surgeon_name, h.name as hospital_name
                FROM surgical_history sh
                LEFT JOIN doctor d ON sh.surgeon_id = d.doctor_id
                LEFT JOIN hospital h ON sh.hospital_id = h.hospital_id
                WHERE sh.patient_id = $1
                ORDER BY sh.performed_at DESC;
            `;
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get surgical history: ${error.message}`);
            throw error;
        }
    };

    getPatientVaccinations = async (patientId) => {
        try {
            const query = `
                SELECT vr.*, d.name as administered_by_name, h.name as hospital_name
                FROM vaccination_record vr
                LEFT JOIN doctor d ON vr.administered_by = d.doctor_id
                LEFT JOIN hospital h ON vr.hospital_id = h.hospital_id
                WHERE vr.patient_id = $1
                ORDER BY vr.administered_at DESC;
            `;
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get vaccination records: ${error.message}`);
            throw error;
        }
    };

    getPatientAllergies = async (patientId) => {
        try {
            const query = `
                SELECT pa.*, d.generic_name, d.brand_name, d.drug_class
                FROM patient_allergy pa
                JOIN drug d ON pa.drug_id = d.drug_id
                WHERE pa.patient_id = $1
                ORDER BY pa.created_at DESC;
            `;
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get allergies: ${error.message}`);
            throw error;
        }
    };

    getPatientActivePrescriptions = async (patientId) => {
        try {
            const query = `
                SELECT p.*, d.name as doctor_name
                FROM prescription p
                LEFT JOIN doctor d ON p.doctor_id = d.doctor_id
                WHERE p.patient_id = $1 AND p.status = 'active'
                ORDER BY p.issued_at DESC;
            `;
            const prescriptionsResult = await this.db_connection.query_executor(query, [patientId]);
            const prescriptions = prescriptionsResult.rows;

            for (const rx of prescriptions) {
                const itemsQuery = `
                    SELECT pi.*, dr.generic_name, dr.brand_name, dr.drug_class
                    FROM prescription_item pi
                    JOIN drug dr ON pi.drug_id = dr.drug_id
                    WHERE pi.prescription_id = $1;
                `;
                const itemsResult = await this.db_connection.query_executor(itemsQuery, [rx.prescription_id]);
                rx.items = itemsResult.rows;
            }

            return prescriptions;
        } catch (error) {
            console.error(`Failed to get active prescriptions: ${error.message}`);
            throw error;
        }
    };

    getPatientReports = async (patientId) => {
        try {
            const query = `
                SELECT mr.*, mr.ordering_doctor as doctor_name
                FROM medical_report mr
                WHERE mr.patient_id = $1
                ORDER BY mr.uploaded_at DESC;
            `;
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get medical reports: ${error.message}`);
            throw error;
        }
    };

    // Prescription Writing
    createPrescription = async (patientId, doctorId) => {
        try {
            const query = `
                INSERT INTO prescription (patient_id, doctor_id, status, llm_interaction_checked)
                VALUES ($1, $2, 'active', FALSE)
                RETURNING *;
            `;
            const result = await this.db_connection.query_executor(query, [patientId, doctorId]);
            return result.rows[0];
        } catch (error) {
            console.error(`Failed to create prescription record: ${error.message}`);
            throw error;
        }
    };

    addPrescriptionItem = async (prescriptionId, drugId, dosage, frequency, durationDays, instructions) => {
        try {
            const query = `
                INSERT INTO prescription_item (prescription_id, drug_id, dosage, frequency, duration_days, instructions)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;
            `;
            const result = await this.db_connection.query_executor(query, [prescriptionId, drugId, dosage, frequency, durationDays, instructions]);
            return result.rows[0];
        } catch (error) {
            console.error(`Failed to add prescription item: ${error.message}`);
            throw error;
        }
    };

    updatePrescriptionLLMCheck = async (prescriptionId, checked, alertMessage) => {
        try {
            const query = `
                UPDATE prescription
                SET llm_interaction_checked = $1,
                    interaction_alert = $2,
                    updated_at = NOW()
                WHERE prescription_id = $3
                RETURNING *;
            `;
            const result = await this.db_connection.query_executor(query, [checked, alertMessage, prescriptionId]);
            return result.rows[0];
        } catch (error) {
            console.error(`Failed to update prescription LLM check: ${error.message}`);
            throw error;
        }
    };

    // Helper to search drug catalog
    getDrugById = async (drugId) => {
        try {
            const query = `SELECT * FROM drug WHERE drug_id = $1 LIMIT 1;`;
            const result = await this.db_connection.query_executor(query, [drugId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Failed to find drug: ${error.message}`);
            throw error;
        }
    };

    searchDrugs = async (searchTerm) => {
        try {
            const query = `
                SELECT * FROM drug 
                WHERE generic_name ILIKE $1 OR brand_name ILIKE $1 OR drug_class ILIKE $1
                LIMIT 20;
            `;
            const result = await this.db_connection.query_executor(query, [`%${searchTerm}%`]);
            return result.rows;
        } catch (error) {
            console.error(`Failed to search drugs: ${error.message}`);
            throw error;
        }
    };

    // Logging & Caching interaction
    logLLMQuery = async (patientId, queryType, inputContext, outputSummary, tokensUsed = 0, modelUsed = 'claude-3-5-sonnet-latest') => {
        try {
            const query = `
                INSERT INTO llm_query_log (patient_id, query_type, input_context, output_summary, model_used, tokens_used)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING query_id;
            `;
            await this.db_connection.query_executor(query, [patientId, queryType, inputContext, outputSummary, modelUsed, tokensUsed]);
        } catch (error) {
            console.error(`Failed to log LLM query: ${error.message}`);
        }
    };

    saveDrugInteraction = async (drugAId, drugBId, severity, description, confidenceScore = 1.0) => {
        try {
            const query = `
                INSERT INTO drug_interaction (drug_a_id, drug_b_id, severity, description, confidence_score)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (drug_a_id, drug_b_id) DO UPDATE 
                SET severity = EXCLUDED.severity, description = EXCLUDED.description, confidence_score = EXCLUDED.confidence_score, created_at = NOW()
                RETURNING *;
            `;
            const result = await this.db_connection.query_executor(query, [drugAId, drugBId, severity, description, confidenceScore]);
            return result.rows[0];
        } catch (error) {
            console.error(`Failed to save drug interaction cache: ${error.message}`);
        }
    };

    getDrugInteraction = async (drugAId, drugBId) => {
        try {
            const query = `
                SELECT * FROM drug_interaction 
                WHERE (drug_a_id = $1 AND drug_b_id = $2) OR (drug_a_id = $2 AND drug_b_id = $1)
                LIMIT 1;
            `;
            const result = await this.db_connection.query_executor(query, [drugAId, drugBId]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Failed to get drug interaction: ${error.message}`);
            return null;
        }
    };

    updatePrescriptionItemStatus = async (patientId, itemId, status, pauseDurationDays, modificationNotes) => {
        try {
            const query = `
                UPDATE prescription_item pi
                SET status = $1,
                    pause_duration_days = $2,
                    paused_at = CASE WHEN $1 = 'paused' THEN NOW() ELSE NULL END,
                    modification_notes = $3
                FROM prescription p
                WHERE pi.prescription_id = p.prescription_id
                  AND p.patient_id = $4
                  AND pi.item_id = $5
                RETURNING pi.*;
            `;
            const result = await this.db_connection.query_executor(query, [
                status,
                pauseDurationDays,
                modificationNotes,
                patientId,
                itemId
            ]);
            return result.rows[0] || null;
        } catch (error) {
            console.error(`Failed to update prescription item status: ${error.message}`);
            throw error;
        }
    };

    getAllHospitals = async () => {
        try {
            const query = `SELECT * FROM hospital ORDER BY name ASC;`;
            const result = await this.db_connection.query_executor(query);
            return result.rows;
        } catch (error) {
            console.error(`Failed to get hospitals: ${error.message}`);
            throw error;
        }
    };
}

module.exports = DoctorModel;
