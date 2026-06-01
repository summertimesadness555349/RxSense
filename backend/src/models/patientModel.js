const DB_Connection = require('../database/db.js');
const AppointmentModel = require('./appointmentModel.js');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PatientModel {
    constructor() {
        this.db_connection = new DB_Connection();
        this.appointmentModel = new AppointmentModel();
    }

    bookAppointment = async ({ doctorId, patientId, appointmentDate }) => {
        return this.appointmentModel.createAppointmentWithLimit({
            doctorId,
            patientId,
            appointmentDate,
        });
    };

    getPatientAppointments = async (patientId, appointmentDate = null) => {
        return this.appointmentModel.getPatientAppointments(patientId, appointmentDate);
    };

    cancelAppointment = async (appointmentId, patientId) => {
        return this.appointmentModel.cancelAppointmentForPatient(appointmentId, patientId);
    };

    getPatientProfile = async ({ patientId } = {}) => {
        try {
            const query = `
                SELECT
                    patient_id AS id,
                    name,
                    date_of_birth AS "dateOfBirth",
                    gender,
                    blood_group AS "bloodGroup",
                    smoking_status AS "smokingStatus",
                    phone,
                    username,
                    email,
                    height,
                    weight,
                    blood_pressure_systolic    AS "bloodPressureSystolic",
                    blood_pressure_diastolic   AS "bloodPressureDiastolic",
                    bp_recorded_at             AS "bpRecordedAt",
                    emergency_contact_name     AS "emergencyContactName",
                    emergency_contact_phone    AS "emergencyContactPhone",
                    emergency_contact_relation AS "emergencyContactRelation",
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
                    kc.diagnosed_at,
                    TO_CHAR(kc.diagnosed_at, 'YYYY') AS since,
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
                since: condition.since ? String(new Date(condition.since).getFullYear()) : null,
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
                year: surgery.date ? new Date(surgery.date).getFullYear().toString() : null,
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

    createMedicalReport = async ({
        patientId,
        reportType,
        imageUrl        = null,
        imagePublicId   = null,
        rawAnalysis     = null,
        reportDate      = null,
        facility        = null,
        orderingDoctor  = null,
        patientNameRep  = null,
    }) => {
        const query = `
            INSERT INTO medical_report
                (patient_id, report_type,
                 image_url, image_public_id, raw_analysis,
                 report_date, facility, ordering_doctor, patient_name_rep)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        const params = [
            patientId, reportType,
            imageUrl, imagePublicId,
            rawAnalysis ? JSON.stringify(rawAnalysis) : null,
            reportDate, facility, orderingDoctor, patientNameRep,
        ];
        const result = await this.db_connection.query_executor(query, params);
        return result.rows[0] || null;
    };

    // Fuzzy lookup in lab_test_info by lowercased label.
    // Priority: prefix-starts-with match first, then trigram similarity.
    findLabTestInfo = async (labelLower) => {
        const query = `
            SELECT reference_range, normal_meaning, high_meaning, low_meaning
            FROM   lab_test_info
            WHERE  name_lower LIKE $1 || '%'
               OR  similarity(name_lower, $1) > 0.3
            ORDER BY
                CASE WHEN name_lower = $1                  THEN 0
                     WHEN name_lower LIKE $1 || ' %'       THEN 1
                     ELSE 2
                END,
                similarity(name_lower, $1) DESC
            LIMIT 1;
        `;
        try {
            const result = await this.db_connection.query_executor(query, [labelLower]);
            return result.rows[0] || null;
        } catch (err) {
            console.warn('[PatientModel] findLabTestInfo failed for:', labelLower, err.message);
            return null;
        }
    };

    addReportMetric = async ({ reportId, parameterName, value, unit, referenceRange, status, llmFlagged }) => {
        const query = `
            INSERT INTO report_metric (report_id, parameter_name, value, unit, reference_range, status, llm_flagged)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const params = [reportId, parameterName, value, unit, referenceRange, status, llmFlagged];
        const result = await this.db_connection.query_executor(query, params);
        return result.rows[0] || null;
    };

    logLLMQuery = async ({ patientId, queryType, inputContext, outputSummary, modelUsed, tokensUsed = 0 }) => {
        const query = `
            INSERT INTO llm_query_log (patient_id, query_type, input_context, output_summary, model_used, tokens_used)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING query_id;
        `;
        const params = [patientId, queryType, inputContext, outputSummary, modelUsed, tokensUsed];
        const result = await this.db_connection.query_executor(query, params);
        return result.rows[0] || null;
    };

    getReportMetrics = async (reportId) => {
        const query = `
            SELECT *
            FROM report_metric
            WHERE report_id = $1
            ORDER BY created_at ASC;
        `;
        const result = await this.db_connection.query_executor(query, [reportId]);
        return result.rows;
    };

    // Returns the most-recent value for every unique parameter name across all reports for a patient.
    getPatientDocuments = async (patientId, userId) => {
        const reportsResult = await this.db_connection.query_executor(`
            SELECT
                report_id          AS id,
                'report'           AS source,
                report_type        AS doc_type,
                image_url,
                COALESCE(report_date, uploaded_at::date)::text AS doc_date,
                facility,
                ordering_doctor    AS doctor,
                uploaded_at        AS created_at
            FROM medical_report
            WHERE patient_id = $1
            ORDER BY uploaded_at DESC
            LIMIT 100;
        `, [patientId]);

        let prescriptionsRows = [];
        try {
            const where = [];
            const params = [patientId];
            where.push(`patient_id = $1`);
            if (userId) { where.push(`user_id = $2`); params.push(userId); }
            const presResult = await this.db_connection.query_executor(`
                SELECT
                    scan_id        AS id,
                    'prescription' AS source,
                    'prescription' AS doc_type,
                    image_url,
                    COALESCE(rx_date, created_at::date)::text AS doc_date,
                    hospital_name  AS facility,
                    doctor_name    AS doctor,
                    created_at
                FROM prescription_scan
                WHERE ${where.join(' OR ')}
                ORDER BY created_at DESC
                LIMIT 100;
            `, params);
            prescriptionsRows = presResult.rows || [];
        } catch {
            // prescription_scan may not exist in all deployments
        }

        return {
            reports:       reportsResult.rows || [],
            prescriptions: prescriptionsRows,
        };
    };

    getLatestReportMetrics = async (patientId) => {
        // report_date is free-text (e.g. "18/12/2024") — use uploaded_at for sorting
        const query = `
            SELECT DISTINCT ON (LOWER(TRIM(rm.parameter_name)))
                rm.parameter_name AS "parameterName",
                rm.value,
                rm.unit,
                rm.reference_range AS "referenceRange",
                rm.status,
                rm.llm_flagged AS "llmFlagged",
                mr.uploaded_at AS "recordedAt"
            FROM report_metric rm
            JOIN medical_report mr ON mr.report_id = rm.report_id
            WHERE mr.patient_id = $1
            ORDER BY LOWER(TRIM(rm.parameter_name)),
                     mr.uploaded_at DESC;
        `;
        try {
            const result = await this.db_connection.query_executor(query, [patientId]);
            return result.rows || [];
        } catch (err) {
            console.warn('[PatientModel] getLatestReportMetrics failed:', err.message);
            return [];
        }
    };

    getActiveMedications = async (patientId) => {
        const query = `
            SELECT
                pi.item_id AS id,
                pi.item_id,
                pi.prescription_id,
                pi.dosage,
                pi.frequency,
                pi.duration_days,
                pi.instructions,
                COALESCE(pi.status, 'active') AS status,
                pi.paused_at,
                pi.pause_duration_days,
                pi.modification_notes,
                dr.generic_name,
                dr.brand_name,
                dr.drug_class,
                p.issued_at,
                p.status AS prescription_status,
                d.name AS doctor_name
            FROM prescription_item pi
            JOIN prescription p ON p.prescription_id = pi.prescription_id
            JOIN drug dr ON dr.drug_id = pi.drug_id
            LEFT JOIN doctor d ON d.doctor_id = p.doctor_id
            WHERE p.patient_id = $1
              AND p.status = 'active'
            ORDER BY p.issued_at DESC, dr.brand_name ASC NULLS LAST, dr.generic_name ASC;
        `;
        const result = await this.db_connection.query_executor(query, [patientId]);
        return result.rows || [];
    };

    updatePatientVitals = async (patientId, {
        bloodGroup, smokingStatus,
        height, weight,
        bloodPressureSystolic, bloodPressureDiastolic, bpRecordedAt,
        emergencyContactName, emergencyContactPhone, emergencyContactRelation,
        phone, dateOfBirth, gender,
    } = {}) => {
        const query = `
            UPDATE patient SET
                blood_group                = COALESCE($2,  blood_group),
                smoking_status             = COALESCE($3,  smoking_status),
                height                     = COALESCE($4,  height),
                weight                     = COALESCE($5,  weight),
                blood_pressure_systolic    = COALESCE($6,  blood_pressure_systolic),
                blood_pressure_diastolic   = COALESCE($7,  blood_pressure_diastolic),
                bp_recorded_at             = COALESCE($8,  bp_recorded_at),
                emergency_contact_name     = COALESCE($9,  emergency_contact_name),
                emergency_contact_phone    = COALESCE($10, emergency_contact_phone),
                emergency_contact_relation = COALESCE($11, emergency_contact_relation),
                phone                      = COALESCE($12, phone),
                date_of_birth              = COALESCE($13::date, date_of_birth),
                gender                     = COALESCE($14, gender),
                updated_at                 = NOW()
            WHERE patient_id = $1
            RETURNING
                patient_id AS id, name, date_of_birth AS "dateOfBirth", gender,
                blood_group AS "bloodGroup", smoking_status AS "smokingStatus",
                phone, height, weight,
                blood_pressure_systolic    AS "bloodPressureSystolic",
                blood_pressure_diastolic   AS "bloodPressureDiastolic",
                bp_recorded_at             AS "bpRecordedAt",
                emergency_contact_name     AS "emergencyContactName",
                emergency_contact_phone    AS "emergencyContactPhone",
                emergency_contact_relation AS "emergencyContactRelation";
        `;
        const params = [
            patientId,
            bloodGroup || null, smokingStatus || null,
            height || null, weight || null,
            bloodPressureSystolic || null, bloodPressureDiastolic || null,
            bpRecordedAt || null,
            emergencyContactName || null, emergencyContactPhone || null,
            emergencyContactRelation || null, phone || null,
            dateOfBirth || null,
            gender      || null,
        ];
        const result = await this.db_connection.query_executor(query, params);
        return result.rows[0] || null;
    };

    resolvePatientIdentity = async (userIdOrUuid) => {
        if (!userIdOrUuid) return { patientId: null, userId: null };

        if (UUID_RE.test(String(userIdOrUuid))) {
            const result = await this.db_connection.query_executor(
                `SELECT patient_id, user_id
                 FROM patient
                 WHERE patient_id = $1
                 LIMIT 1;`,
                [userIdOrUuid]
            );
            return {
                patientId: result.rows[0]?.patient_id || null,
                userId: result.rows[0]?.user_id || null,
            };
        }

        const userId = parseInt(userIdOrUuid, 10);
        if (Number.isNaN(userId)) return { patientId: null, userId: null };

        const result = await this.db_connection.query_executor(
            `SELECT patient_id
             FROM patient
             WHERE user_id = $1
             LIMIT 1;`,
            [userId]
        );
        return {
            patientId: result.rows[0]?.patient_id || null,
            userId,
        };
    };

    getTimelineReports = async (patientId, limit = 50) => {
        const query = `
            SELECT
                report_id,
                report_type,
                report_date,
                facility,
                ordering_doctor,
                raw_analysis,
                uploaded_at
            FROM medical_report
            WHERE patient_id = $1
            ORDER BY uploaded_at DESC
            LIMIT $2;
        `;
        const result = await this.db_connection.query_executor(query, [patientId, limit]);
        return result.rows || [];
    };

    getTimelineReportMetrics = async (reportIds = []) => {
        if (!reportIds.length) return [];
        const query = `
            SELECT
                report_id,
                parameter_name,
                value,
                unit,
                status,
                llm_flagged
            FROM report_metric
            WHERE report_id = ANY($1::uuid[])
            ORDER BY created_at ASC;
        `;
        const result = await this.db_connection.query_executor(query, [reportIds]);
        return result.rows || [];
    };

    getTimelinePrescriptionScans = async ({ patientId, userId, limit = 50 } = {}) => {
        const where = [];
        const params = [];
        let idx = 1;

        if (patientId) {
            where.push(`patient_id = $${idx++}`);
            params.push(patientId);
        }

        if (userId) {
            where.push(`user_id = $${idx++}`);
            params.push(userId);
        }

        if (where.length === 0) return [];

        const query = `
            SELECT
                scan_id,
                doctor_name,
                doctor_specialty,
                hospital_name,
                rx_date,
                medications,
                created_at
            FROM prescription_scan
            WHERE ${where.join(' OR ')}
            ORDER BY created_at DESC
            LIMIT $${idx};
        `;
        params.push(limit);

        const result = await this.db_connection.query_executor(query, params);
        return result.rows || [];
    };

    getTimelineSymptoms = async (patientId, limit = 50) => {
        const query = `
            SELECT
                sl.log_id,
                sl.logged_at,
                sl.symptoms_data,
                sl.body_system,
                ara.risk_level,
                ara.recommendation,
                ara.possible_conditions
            FROM symptom_log sl
            LEFT JOIN ai_risk_assessment ara ON ara.log_id = sl.log_id
            WHERE sl.patient_id = $1
            ORDER BY sl.logged_at DESC
            LIMIT $2;
        `;
        const result = await this.db_connection.query_executor(query, [patientId, limit]);
        return result.rows || [];
    };

    getTimelineVaccinations = async (patientId, limit = 50) => {
        const query = `
            SELECT
                vr.vaccination_id,
                vr.vaccine_name,
                vr.dose_number,
                vr.total_doses,
                vr.administered_at,
                h.name AS facility
            FROM vaccination_record vr
            LEFT JOIN hospital h ON h.hospital_id = vr.hospital_id
            WHERE vr.patient_id = $1
            ORDER BY vr.administered_at DESC
            LIMIT $2;
        `;
        const result = await this.db_connection.query_executor(query, [patientId, limit]);
        return result.rows || [];
    };

    getTimelineConditions = async (patientId, limit = 50) => {
        const query = `
            SELECT
                kc.condition_id,
                kc.condition_name,
                kc.diagnosed_at,
                kc.notes,
                d.name AS doctor_name,
                d.specialty AS doctor_specialty,
                kc.created_at
            FROM known_condition kc
            LEFT JOIN doctor d ON d.doctor_id = kc.diagnosed_by
            WHERE kc.patient_id = $1
            ORDER BY COALESCE(kc.diagnosed_at, kc.created_at) DESC
            LIMIT $2;
        `;
        const result = await this.db_connection.query_executor(query, [patientId, limit]);
        return result.rows || [];
    };
}

module.exports = PatientModel;
