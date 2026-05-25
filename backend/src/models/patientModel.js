const DB_Connection = require('../database/db.js');

class PatientModel {
    constructor() {
        this.db_connection = new DB_Connection();
    }

    getPatientProfile = async ({ patientId } = {}) => {
        try {
            const query = `
                SELECT
                    patient_id AS id,
                    name,
                    date_of_birth AS "dateOfBirth",
                    gender,
                    blood_group AS "bloodGroup",
                    location,
                    COALESCE(phone, contact_info) AS "phone",
                    contact_info AS "contactInfo",
                    username,
                    email,
                    height,
                    weight,
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
                FROM patient
                WHERE patient_id = $1
                LIMIT 1;
            `;

            const result = await this.db_connection.query_executor(query, [patientId]);
            const patient = result.rows[0] || null;

            if (!patient) {
                return null;
            }

            patient.allergies = await this.getPatientAllergies(patientId);
            patient.conditions = await this.getPatientConditions(patientId);
            patient.surgeries = await this.getPatientSurgeries(patientId);
            patient.vaccinations = await this.getPatientVaccinations(patientId);

            return patient;
        } catch (error) {
            console.log(`Finding patient profile failed: ${error.message}`);
            throw error;
        }
    }

    getPatientAllergies = async (patientId) => {
        try {
            const query = `
                SELECT
                    pa.allergy_id AS id,
                    pa.drug_id AS "drugId",
                    COALESCE(d.generic_name, d.brand_name) AS name,
                    pa.reaction_type AS "reaction",
                    pa.severity,
                    pa.confirmed_at AS "confirmedAt",
                    pa.llm_flagged AS "llmFlagged",
                    pa.created_at AS "createdAt"
                FROM patient_allergy pa
                LEFT JOIN drug d ON d.drug_id = pa.drug_id
                WHERE pa.patient_id = $1
                ORDER BY pa.created_at DESC;
            `;

            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows || [];
        } catch (error) {
            console.log(`Finding patient allergies failed: ${error.message}`);
            throw error;
        }
    }

    getPatientConditions = async (patientId) => {
        try {
            const query = `
                SELECT
                    condition_id AS id,
                    condition_name AS name,
                    kc.diagnosed_at AS "since",
                    kc.status,
                    kc.severity,
                    kc.diagnosed_by AS "doctorId",
                    d.name AS doctor,
                    kc.notes AS notes,
                    kc.created_at AS "createdAt",
                    kc.updated_at AS "updatedAt"
                FROM known_condition kc
                LEFT JOIN doctor d ON d.doctor_id = kc.diagnosed_by
                WHERE kc.patient_id = $1
                ORDER BY COALESCE(kc.diagnosed_at, kc.created_at) DESC;
            `;

            const result = await this.db_connection.query_executor(query, [patientId]);
            return (result.rows || []).map((condition) => ({
                ...condition,
                since: condition.diagnosed_at ? String(new Date(condition.diagnosed_at).getFullYear()) : null,
            }));
        } catch (error) {
            console.log(`Finding patient conditions failed: ${error.message}`);
            throw error;
        }
    }

    getPatientSurgeries = async (patientId) => {
        try {
            const query = `
                SELECT
                    sh.surgery_id AS id,
                    sh.procedure_name AS name,
                    sh.performed_at AS date,
                    TO_CHAR(sh.performed_at, 'YYYY') AS year,
                    sh.outcome,
                    sh.complications,
                    sh.anaesthesia_type AS "anaesthesiaType",
                    sh.hospital_id AS "hospitalId",
                    h.name AS facility,
                    sh.surgeon_id AS "surgeonId",
                    doc.name AS surgeon,
                    sh.notes,
                    sh.created_at AS "createdAt"
                FROM surgical_history sh
                LEFT JOIN hospital h ON h.hospital_id = sh.hospital_id
                LEFT JOIN doctor doc ON doc.doctor_id = sh.surgeon_id
                WHERE sh.patient_id = $1
                ORDER BY COALESCE(sh.performed_at, sh.created_at) DESC;
            `;

            const result = await this.db_connection.query_executor(query, [patientId]);
            return (result.rows || []).map((surgery) => ({
                ...surgery,
                year: surgery.performed_at ? new Date(surgery.performed_at).getFullYear().toString() : null,
            }));
        } catch (error) {
            console.log(`Finding patient surgeries failed: ${error.message}`);
            throw error;
        }
    }

    getPatientVaccinations = async (patientId) => {
        try {
            const query = `
                SELECT
                    vr.vaccination_id AS id,
                    vr.vaccine_name AS name,
                    vr.dose_number AS dose,
                    vr.total_doses AS "totalDoses",
                    vr.administered_at,
                    vr.batch_number AS "batchNumber",
                    vr.site,
                    h.name AS facility,
                    vr.administered_by AS "administeredBy",
                    doc.name AS administeredByName,
                    vr.next_due_date AS "nextDueDate",
                    vr.notes,
                    vr.created_at AS "createdAt"
                FROM vaccination_record vr
                LEFT JOIN hospital h ON h.hospital_id = vr.hospital_id
                LEFT JOIN doctor doc ON doc.doctor_id = vr.administered_by
                WHERE vr.patient_id = $1
                ORDER BY COALESCE(vr.administered_at, vr.created_at) DESC;
            `;

            const result = await this.db_connection.query_executor(query, [patientId]);
            return (result.rows || []).map((vaccination) => ({
                ...vaccination,
                date: vaccination.administered_at ? new Date(vaccination.administered_at).toISOString().slice(0, 10) : null,
            }));
        } catch (error) {
            console.log(`Finding patient vaccinations failed: ${error.message}`);
            throw error;
        }
    }
}

module.exports = PatientModel;