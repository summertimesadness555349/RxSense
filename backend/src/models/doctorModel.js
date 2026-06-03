const DB_Connection = require("../database/db.js");

class DoctorModel {
  constructor() {
    this.db_connection = new DB_Connection();
  }

  createDoctor = async (doctorData) => {
    try {
      const {
        name,
        specialty,
        licenseNumber,
        gender,
        username,
        email,
        password,
      } = doctorData;

      // Ensure specialty is stored as an array of strings in PostgreSQL
      let specialtyArray = [];
      if (Array.isArray(specialty)) {
        specialtyArray = specialty;
      } else if (typeof specialty === "string") {
        specialtyArray = specialty
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const query = `
                INSERT INTO doctor (name, specialty, license_number, gender, username, email, password)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING doctor_id, name, specialty, license_number, gender, username, email, created_at, updated_at;
            `;
      const params = [
        name,
        specialtyArray,
        licenseNumber,
        gender,
        username,
        email,
        password,
      ];
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
                SELECT doctor_id, name, specialty, license_number, gender, username, email,
                       last_login, daily_patient_limit, created_at, updated_at
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
      const result = await this.db_connection.query_executor(query, [
        licenseNumber,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error(
        `Finding doctor by license number failed: ${error.message}`
      );
      throw error;
    }
  };

  updateDoctor = async (doctorId, updates) => {
    try {
      if (!updates || Object.keys(updates).length === 0) {
        throw new Error("No updates were sent");
      }

      const allowed = new Set([
        "name",
        "specialty",
        "gender",
        "username",
        "email",
        "password",
        "daily_patient_limit",
      ]);
      const sets = [];
      const values = [];
      let idx = 1;

      for (let [key, value] of Object.entries(updates)) {
        if (!allowed.has(key)) continue;

        if (key === "specialty") {
          if (Array.isArray(value)) {
            // Value is already an array
          } else if (typeof value === "string") {
            value = value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
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
                SET ${sets.join(", ")}
                WHERE doctor_id = $${idx}
                RETURNING doctor_id, name, specialty, license_number, gender, username, email,
                          daily_patient_limit, created_at, updated_at;
            `;
      const result = await this.db_connection.query_executor(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Doctor update failed: ${error.message}`);
      throw error;
    }
  };

  findFirstAvailableDate = async (doctorId, newLimit) => {
    // Helper to get local YYYY-MM-DD string without timezone shifting issues
    const getLocalDateStr = (date) => {
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - offset * 60 * 1000);
      return localDate.toISOString().slice(0, 10);
    };

    const todayStr = getLocalDateStr(new Date());

    try {
      // 1. Cast appointment_date to ::date so Postgres groups by calendar day, not exact time.
      const query = `
            SELECT appointment_date::date AS appointment_day, COUNT(*)::int AS count
            FROM appointment
            WHERE doctor_id = $1
              AND appointment_date >= $2
              AND status IN ('booked', 'late', 'in_progress', 'completed')
            GROUP BY appointment_date::date
            HAVING COUNT(*) >= $3
            ORDER BY appointment_day ASC;
        `;

      const result = await this.db_connection.query_executor(query, [
        doctorId,
        todayStr,
        newLimit,
      ]);

      if (result.rows.length === 0) return todayStr;

      // 2. Safely parse the DB date to a YYYY-MM-DD string format for your Set
      const blockedDates = new Set(
        result.rows.map((r) => {
          // If it's already a JS Date, convert it. If it's a string, slice it.
          const d = new Date(r.appointment_day);
          return getLocalDateStr(d);
        })
      );

      let checkDate = new Date(); // Starts at today

      for (let i = 0; i < 365; i++) {
        const dateStr = getLocalDateStr(checkDate);

        // 3. Now this comparison works perfectly (String vs String)
        if (!blockedDates.has(dateStr)) {
          return dateStr;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }

      return todayStr;
    } catch (error) {
      console.error(`Failed to find available date: ${error.message}`);
      return todayStr;
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
  addHospitalAffiliation = async (
    doctorId,
    hospitalId,
    role,
    isPrimary = false
  ) => {
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
      const result = await this.db_connection.query_executor(queryFix, [
        doctorId,
        hospitalId,
        role,
        isPrimary,
      ]);
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

  getDoctorsForBooking = async () => {
    try {
      const query = `
                SELECT doctor_id, name, specialty, gender, daily_patient_limit
                FROM doctor
                ORDER BY name ASC;
            `;
      const result = await this.db_connection.query_executor(query);
      return result.rows || [];
    } catch (error) {
      console.error(`Failed to get doctors: ${error.message}`);
      throw error;
    }
  };

  getAvailabilityByDate = async (doctorId, availabilityDate) => {
    try {
      const query = `
            SELECT
                da.availability_id,
                da.doctor_id,
                da.availability_date,
                da.start_time,
                da.end_time,
                da.daily_limit,
                da.created_at,
                da.updated_at
            FROM doctor_availability da
            WHERE da.doctor_id = $1
              AND da.availability_date <= $2
            ORDER BY da.availability_date DESC
            LIMIT 1;
        `;

      const result = await this.db_connection.query_executor(query, [
        doctorId,
        availabilityDate,
      ]);

      return result.rows[0] || null;
    } catch (error) {
      console.error(`Failed to get availability: ${error.message}`);
      throw error;
    }
  };

  upsertAvailability = async ({
    doctorId,
    availabilityDate,
    startTime,
    endTime,
    dailyLimit,
  }) => {
    const normalizeTime = (value) => (value ? String(value).slice(0, 5) : null);

    return this.db_connection.run_in_transaction(async (client) => {
      // Resolve daily limit: use provided value, else fall back to doctor's daily_patient_limit
      let effectiveDailyLimit = dailyLimit;
      if (effectiveDailyLimit === null || effectiveDailyLimit === undefined) {
        const docResult = await client.query(
          `SELECT daily_patient_limit FROM doctor WHERE doctor_id = $1;`,
          [doctorId]
        );
        effectiveDailyLimit = docResult.rows[0]?.daily_patient_limit ?? 30;
      }

      const existingResult = await client.query(
        `SELECT availability_id, start_time, end_time, daily_limit
                 FROM doctor_availability
                 WHERE doctor_id = $1
                   AND availability_date = $2
                 FOR UPDATE;`,
        [doctorId, availabilityDate]
      );
      const existing = existingResult.rows[0] || null;

      const countResult = await client.query(
        `SELECT COUNT(*)::int AS count
                 FROM appointment
                 WHERE doctor_id = $1
                   AND appointment_date = $2
                   AND status IN ('booked', 'late', 'in_progress', 'completed');`,
        [doctorId, availabilityDate]
      );
      const bookedCount = countResult.rows[0]?.count || 0;

      if (bookedCount > 0) {
        if (!existing) {
          const error = new Error(
            "This date already has appointments. You can only set availability for future dates without any bookings."
          );
          error.code = "SCHEDULE_LOCKED";
          throw error;
        }

        const existingStart = normalizeTime(existing.start_time);
        const existingEnd = normalizeTime(existing.end_time);
        if (
          existingStart !== normalizeTime(startTime) ||
          existingEnd !== normalizeTime(endTime)
        ) {
          const error = new Error(
            "This date has existing appointments. Time changes only apply to future dates without bookings. Please pick a different date to change the time window."
          );
          error.code = "SCHEDULE_LOCKED";
          throw error;
        }

        if (effectiveDailyLimit !== null && effectiveDailyLimit !== undefined) {
          const limitValue = Number(effectiveDailyLimit);
          if (Number.isFinite(limitValue) && bookedCount >= limitValue) {
            const error = new Error(
              "Daily limit cannot be lower than the number of booked appointments"
            );
            error.code = "LIMIT_LOCKED";
            throw error;
          }
        }
      }

      let result;
      if (existing) {
        const updateResult = await client.query(
          `UPDATE doctor_availability
                     SET start_time = $1,
                         end_time = $2,
                         daily_limit = $3,
                         updated_at = NOW()
                     WHERE availability_id = $4
                     RETURNING *;`,
          [startTime, endTime, effectiveDailyLimit, existing.availability_id]
        );
        result = updateResult.rows[0];
      } else {
        const insertResult = await client.query(
          `INSERT INTO doctor_availability
                        (doctor_id, availability_date, start_time, end_time, daily_limit)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING *;`,
          [doctorId, availabilityDate, startTime, endTime, effectiveDailyLimit]
        );
        result = insertResult.rows[0];
      }

      // Propagate start_time/end_time to all future dates without bookings
      await client.query(
        `UPDATE doctor_availability
                 SET start_time = $1, end_time = $2, updated_at = NOW()
                 WHERE doctor_id = $3
                   AND availability_date > $4
                   AND NOT EXISTS (
                       SELECT 1 FROM appointment
                       WHERE appointment.doctor_id = doctor_availability.doctor_id
                         AND appointment.appointment_date = doctor_availability.availability_date
                         AND appointment.status IN ('booked', 'late', 'in_progress', 'completed')
                   );`,
        [startTime, endTime, doctorId, availabilityDate]
      );

      return result;
    });
  };

  getPatientsByAppointmentDate = async (doctorId, appointmentDate) => {
    try {
      const query = `
                SELECT
                    p.patient_id,
                    p.name,
                    p.date_of_birth,
                    p.gender,
                    p.phone,
                    p.email,
                    a.appointment_id,
                    a.appointment_date,
                    a.status,
                    a.priority_flag,
                    a.priority_reason,
                    a.arrival_time,
                    a.seen_at,
                    a.serial_number,
                    da.start_time AS availability_start_time
                FROM appointment a
                JOIN patient p ON p.patient_id = a.patient_id
                LEFT JOIN doctor_availability da ON da.doctor_id = a.doctor_id AND da.availability_date = a.appointment_date
                WHERE a.doctor_id = $1
                  AND a.appointment_date = $2
                  AND a.status IN ('booked', 'late', 'in_progress')
                ORDER BY a.priority_flag DESC,
                         a.serial_number ASC;
            `;
      const result = await this.db_connection.query_executor(query, [
        doctorId,
        appointmentDate,
      ]);
      return result.rows || [];
    } catch (error) {
      console.error(`Failed to get appointment patients: ${error.message}`);
      throw error;
    }
  };

  getAppointmentsByDate = async (doctorId, appointmentDate) => {
    try {
      const query = `
                SELECT
                    a.*,
                    p.name AS patient_name,
                    p.phone AS patient_phone,
                    p.email AS patient_email
                FROM appointment a
                JOIN patient p ON p.patient_id = a.patient_id
                WHERE a.doctor_id = $1
                  AND a.appointment_date = $2
                ORDER BY a.priority_flag DESC,
                         a.serial_number ASC;
            `;
      const result = await this.db_connection.query_executor(query, [
        doctorId,
        appointmentDate,
      ]);
      return result.rows || [];
    } catch (error) {
      console.error(`Failed to get appointments: ${error.message}`);
      throw error;
    }
  };

  updateAppointment = async (appointmentId, doctorId, updates) => {
    if (!updates || Object.keys(updates).length === 0) return null;

    const allowed = new Set([
      "status",
      "arrival_time",
      "seen_at",
      "priority_flag",
      "priority_reason",
      "updated_at",
    ]);

    const sets = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.has(key)) continue;
      sets.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (!sets.length) return null;

    values.push(appointmentId, doctorId);

    const query = `
            UPDATE appointment
            SET ${sets.join(", ")}
            WHERE appointment_id = $${idx++}
              AND doctor_id = $${idx}
            RETURNING *;
        `;

    const result = await this.db_connection.query_executor(query, values);
    return result.rows[0] || null;
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
      const result = await this.db_connection.query_executor(query, [
        patientId,
      ]);
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
      const result = await this.db_connection.query_executor(query, [
        patientId,
      ]);
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
      const result = await this.db_connection.query_executor(query, [
        patientId,
      ]);
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
      const result = await this.db_connection.query_executor(query, [
        patientId,
      ]);
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
      const result = await this.db_connection.query_executor(query, [
        patientId,
      ]);
      return result.rows;
    } catch (error) {
      console.error(`Failed to get allergies: ${error.message}`);
      throw error;
    }
  };

  createPatientAllergy = async (patientId, doctorId, allergyData) => {
    try {
      const query = `
                INSERT INTO patient_allergy (
                    patient_id,
                    drug_id,
                    reaction_type,
                    severity,
                    confirmed_at,
                    llm_flagged
                )
                VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), FALSE)
                RETURNING *;
            `;
      const params = [
        patientId,
        allergyData.drugId,
        allergyData.reactionType,
        allergyData.severity,
        allergyData.confirmedAt || null,
      ];
      const result = await this.db_connection.query_executor(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Failed to create patient allergy: ${error.message}`);
      throw error;
    }
  };

  createPatientVaccination = async (patientId, doctorId, vaccinationData) => {
    try {
      const query = `
                INSERT INTO vaccination_record (
                    patient_id,
                    administered_by,
                    hospital_id,
                    vaccine_name,
                    cvx_code,
                    dose_number,
                    total_doses,
                    administered_at,
                    batch_number,
                    site,
                    next_due_date,
                    notes
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_DATE), $9, $10, $11, $12)
                RETURNING *;
            `;
      const params = [
        patientId,
        doctorId,
        vaccinationData.hospitalId || null,
        vaccinationData.vaccineName,
        vaccinationData.cvxCode || null,
        vaccinationData.doseNumber || null,
        vaccinationData.totalDoses || null,
        vaccinationData.administeredAt || null,
        vaccinationData.batchNumber || null,
        vaccinationData.site || null,
        vaccinationData.nextDueDate || null,
        vaccinationData.notes || null,
      ];
      const result = await this.db_connection.query_executor(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Failed to create vaccination record: ${error.message}`);
      throw error;
    }
  };

  createPatientSurgery = async (patientId, doctorId, surgeryData) => {
    try {
      const query = `
                INSERT INTO surgical_history (
                    patient_id,
                    hospital_id,
                    surgeon_id,
                    procedure_name,
                    icd_10_pcs,
                    performed_at,
                    outcome,
                    complications,
                    anaesthesia_type,
                    notes
                )
                VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_DATE), $7, $8, $9, $10)
                RETURNING *;
            `;
      const params = [
        patientId,
        surgeryData.hospitalId || null,
        doctorId,
        surgeryData.procedureName,
        surgeryData.icd10Pcs || null,
        surgeryData.performedAt || null,
        surgeryData.outcome || null,
        surgeryData.complications || null,
        surgeryData.anaesthesiaType || null,
        surgeryData.notes || null,
      ];
      const result = await this.db_connection.query_executor(query, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error(
        `Failed to create surgical history record: ${error.message}`
      );
      throw error;
    }
  };

  getPatientActivePrescriptions = async (patientId) => {
    try {
      const query = `
                SELECT p.prescription_id, p.patient_id, p.doctor_id, p.issued_at, p.status,
                       p.llm_interaction_checked, p.interaction_alert, p.created_at, p.updated_at,
                       p.referred_by AS "referredBy",
                       p.chief_complaint AS "chiefComplaint",
                       p.examination AS "examination",
                       p.diagnosis AS "diagnosis",
                       p.investigations AS "investigations",
                       p.advice AS "advice",
                       p.follow_up AS "followUp",
                       pi.dosage,
                       pi.frequency,
                       pi.duration_days AS "durationDays",
                       pi.instructions,
                       d.name as doctor_name
                FROM prescription p
                LEFT JOIN doctor d ON p.doctor_id = d.doctor_id
                LEFT JOIN prescription_item pi ON p.prescription_id = pi.prescription_id
                WHERE p.patient_id = $1 AND p.status = 'active' AND pi.prescription_id IS NOT NULL AND pi.status = 'active'
                ORDER BY p.issued_at DESC;
            `;
      const prescriptionsResult = await this.db_connection.query_executor(
        query,
        [patientId]
      );
      const prescriptions = prescriptionsResult.rows;

      for (const rx of prescriptions) {
        const itemsQuery = `
                    SELECT pi.*, dr.generic_name, dr.brand_name, dr.drug_class
                    FROM prescription_item pi
                    JOIN drug dr ON pi.drug_id = dr.drug_id
                    WHERE pi.prescription_id = $1;
                `;
        const itemsResult = await this.db_connection.query_executor(
          itemsQuery,
          [rx.prescription_id]
        );
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
      const result = await this.db_connection.query_executor(query, [
        patientId,
      ]);
      return result.rows;
    } catch (error) {
      console.error(`Failed to get medical reports: ${error.message}`);
      throw error;
    }
  };

  // Prescription Writing
  createPrescription = async (patientId, doctorId, draftData = {}) => {
    try {
      const query = `
                INSERT INTO prescription (
                    patient_id,
                    doctor_id,
                    status,
                    llm_interaction_checked,
                    referred_by,
                    chief_complaint,
                    examination,
                    diagnosis,
                    investigations,
                    advice,
                    follow_up
                )
                VALUES ($1, $2, 'active', FALSE, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *;
            `;
      const params = [
        patientId,
        doctorId,
        draftData.referredBy || null,
        draftData.chiefComplaint || null,
        draftData.examination || null,
        draftData.diagnosis || null,
        draftData.investigations || null,
        draftData.advice || null,
        draftData.followUp || null,
      ];
      const result = await this.db_connection.query_executor(query, params);
      return result.rows[0];
    } catch (error) {
      console.error(`Failed to create prescription record: ${error.message}`);
      throw error;
    }
  };

  addPrescriptionItem = async (
    prescriptionId,
    drugId,
    dosage,
    frequency,
    durationDays,
    instructions
  ) => {
    try {
      const query = `
                INSERT INTO prescription_item (prescription_id, drug_id, dosage, frequency, duration_days, instructions)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *;
            `;
      const result = await this.db_connection.query_executor(query, [
        prescriptionId,
        drugId,
        dosage,
        frequency,
        durationDays,
        instructions,
      ]);
      return result.rows[0];
    } catch (error) {
      console.error(`Failed to add prescription item: ${error.message}`);
      throw error;
    }
  };

  updatePrescriptionLLMCheck = async (
    prescriptionId,
    checked,
    alertMessage
  ) => {
    try {
      const query = `
                UPDATE prescription
                SET llm_interaction_checked = $1,
                    interaction_alert = $2,
                    updated_at = NOW()
                WHERE prescription_id = $3
                RETURNING *;
            `;
      const result = await this.db_connection.query_executor(query, [
        checked,
        alertMessage,
        prescriptionId,
      ]);
      return result.rows[0];
    } catch (error) {
      console.error(
        `Failed to update prescription LLM check: ${error.message}`
      );
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
      const result = await this.db_connection.query_executor(query, [
        `%${searchTerm}%`,
      ]);
      return result.rows;
    } catch (error) {
      console.error(`Failed to search drugs: ${error.message}`);
      throw error;
    }
  };

  // Logging & Caching interaction
  logLLMQuery = async (
    patientId,
    queryType,
    inputContext,
    outputSummary,
    tokensUsed = 0,
    modelUsed = "claude-3-5-sonnet-latest"
  ) => {
    try {
      const query = `
                INSERT INTO llm_query_log (patient_id, query_type, input_context, output_summary, model_used, tokens_used)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING query_id;
            `;
      await this.db_connection.query_executor(query, [
        patientId,
        queryType,
        inputContext,
        outputSummary,
        modelUsed,
        tokensUsed,
      ]);
    } catch (error) {
      console.error(`Failed to log LLM query: ${error.message}`);
    }
  };

  saveDrugInteraction = async (
    drugAId,
    drugBId,
    severity,
    description,
    confidenceScore = 1.0
  ) => {
    try {
      const query = `
                INSERT INTO drug_interaction (drug_a_id, drug_b_id, severity, description, confidence_score)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (drug_a_id, drug_b_id) DO UPDATE 
                SET severity = EXCLUDED.severity, description = EXCLUDED.description, confidence_score = EXCLUDED.confidence_score, created_at = NOW()
                RETURNING *;
            `;
      const result = await this.db_connection.query_executor(query, [
        drugAId,
        drugBId,
        severity,
        description,
        confidenceScore,
      ]);
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
      const result = await this.db_connection.query_executor(query, [
        drugAId,
        drugBId,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error(`Failed to get drug interaction: ${error.message}`);
      return null;
    }
  };

  updatePrescriptionItemStatus = async (
    patientId,
    itemId,
    status,
    pauseDurationDays,
    modificationNotes
  ) => {
    try {
      const query = `
                UPDATE prescription_item pi
                SET status = $1::varchar,
                    pause_duration_days = $2,
                    paused_at = CASE WHEN $1::varchar = 'paused' THEN NOW() ELSE NULL END,
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
        itemId,
      ]);
      return result.rows[0] || null;
    } catch (error) {
      console.error(
        `Failed to update prescription item status: ${error.message}`
      );
      throw error;
    }
  };
  
  getPausedMedicineByPatientId = async (patientId) => {
    try {
      const query = `
                SELECT pi.*, p.prescription_id, p.doctor_id, p.issued_at, p.status as prescription_status,
                       d.name as doctor_name
                FROM prescription_item pi
                JOIN prescription p ON pi.prescription_id = p.prescription_id
                JOIN doctor d ON p.doctor_id = d.doctor_id
                WHERE p.patient_id = $1 AND (pi.status = 'paused' or pi.status = 'stopped');
            `;
      const result = await this.db_connection.query_executor(query, [patientId]);
      return result.rows || [];
    } catch (error) {
      console.error(`Failed to get paused medicines: ${error.message}`);
      throw error;
    }
  }

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
