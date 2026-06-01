const DB_Connection = require('../database/db.js');

class AppointmentModel {
    constructor() {
        this.db_connection = new DB_Connection();
    }

    createAppointmentWithLimit = async ({ doctorId, patientId, appointmentDate }) => {
        return this.db_connection.run_in_transaction(async (client) => {
            const doctorResult = await client.query(
                `SELECT daily_patient_limit
                 FROM doctor
                 WHERE doctor_id = $1
                 FOR UPDATE;`,
                [doctorId]
            );

            if (doctorResult.rows.length === 0) {
                const error = new Error('Doctor not found');
                error.code = 'DOCTOR_NOT_FOUND';
                throw error;
            }

            const dailyLimit = doctorResult.rows[0]?.daily_patient_limit ?? 30;

            const availabilityResult = await client.query(
                `SELECT daily_limit
                 FROM doctor_availability
                 WHERE doctor_id = $1
                   AND availability_date = $2
                 FOR UPDATE;`,
                [doctorId, appointmentDate]
            );
            const availability = availabilityResult.rows[0] || null;

            let effectiveLimit = dailyLimit;

            if (availability) {
                if (availability.daily_limit != null) {
                    effectiveLimit = availability.daily_limit;
                }
            }

            const patientExistingResult = await client.query(
                `SELECT appointment_id
                 FROM appointment
                 WHERE doctor_id = $1
                   AND patient_id = $2
                   AND appointment_date = $3
                   AND status IN ('booked', 'late', 'in_progress', 'completed');`,
                [doctorId, patientId, appointmentDate]
            );

            if (patientExistingResult.rows.length > 0) {
                const error = new Error('You already have an appointment with this doctor on this date');
                error.code = 'PATIENT_ALREADY_BOOKED';
                throw error;
            }

            const countResult = await client.query(
                `SELECT COUNT(*)::int AS count, COALESCE(MAX(serial_number), 0)::int AS max_serial
                 FROM appointment
                 WHERE doctor_id = $1
                   AND appointment_date = $2
                   AND status IN ('booked', 'late', 'in_progress', 'completed');`,
                [doctorId, appointmentDate]
            );

            const activeCount = countResult.rows[0].count;
            const maxSerial = countResult.rows[0].max_serial;

            if (activeCount >= effectiveLimit) {
                const error = new Error('Doctor appointment limit reached for this date');
                error.code = 'DAILY_LIMIT_REACHED';
                throw error;
            }

            const nextSerial = maxSerial + 1;

            const insertResult = await client.query(
                `INSERT INTO appointment (
                    doctor_id,
                    patient_id,
                    appointment_date,
                    status,
                    priority_flag,
                    serial_number
                )
                 VALUES ($1, $2, $3, 'booked', FALSE, $4)
                 ON CONFLICT (doctor_id, patient_id, appointment_date)
                 DO UPDATE SET
                    status = 'booked',
                    priority_flag = FALSE,
                    serial_number = EXCLUDED.serial_number,
                    updated_at = NOW()
                 RETURNING *;`,
                [doctorId, patientId, appointmentDate, nextSerial]
            );

            return insertResult.rows[0];
        });
    };

    getDoctorAppointmentsByDate = async (doctorId, appointmentDate) => {
        const query = `
            SELECT
                a.*, 
                p.patient_id,
                p.name,
                p.date_of_birth,
                p.gender,
                p.phone,
                p.email
            FROM appointment a
            JOIN patient p ON a.patient_id = p.patient_id
            WHERE a.doctor_id = $1
              AND a.appointment_date = $2
              AND a.status IN ('booked', 'late', 'in_progress', 'completed')
            ORDER BY a.priority_flag DESC,
                     a.arrival_time NULLS LAST,
                     a.serial_number ASC;
        `;
        const result = await this.db_connection.query_executor(query, [doctorId, appointmentDate]);
        return result.rows || [];
    };

    getPatientAppointments = async (patientId, appointmentDate = null) => {
        const where = ['a.patient_id = $1'];
        const params = [patientId];
        let idx = 2;

        if (appointmentDate) {
            where.push(`a.appointment_date = $${idx++}`);
            params.push(appointmentDate);
        }

        const query = `
            SELECT
                a.*,
                d.doctor_id,
                d.name AS doctor_name,
                d.specialty,
                da.start_time AS availability_start_time
            FROM appointment a
            JOIN doctor d ON a.doctor_id = d.doctor_id
            LEFT JOIN doctor_availability da ON da.doctor_id = a.doctor_id AND da.availability_date = a.appointment_date
            WHERE ${where.join(' AND ')}
            ORDER BY a.appointment_date DESC, a.serial_number ASC;
        `;
        const result = await this.db_connection.query_executor(query, params);
        return result.rows || [];
    };

    patientMarkArrived = async (appointmentId, patientId) => {
        const query = `
            UPDATE appointment
            SET arrival_time = NOW(),
                updated_at = NOW()
            WHERE appointment_id = $1
              AND patient_id = $2
              AND status IN ('booked', 'late')
            RETURNING *;
        `;
        const result = await this.db_connection.query_executor(query, [appointmentId, patientId]);
        return result.rows[0] || null;
    };

    cancelAppointmentForPatient = async (appointmentId, patientId) => {
        return this.db_connection.run_in_transaction(async (client) => {
            const target = await client.query(
                `SELECT appointment_id, doctor_id, appointment_date, serial_number
                 FROM appointment
                 WHERE appointment_id = $1
                   AND patient_id = $2
                   AND status IN ('booked', 'late')
                 FOR UPDATE;`,
                [appointmentId, patientId]
            );

            if (!target.rows.length) return null;
            const { doctor_id, appointment_date, serial_number } = target.rows[0];

            await client.query(
                `UPDATE appointment
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE appointment_id = $1;`,
                [appointmentId]
            );

            if (serial_number != null) {
                await client.query(
                    `UPDATE appointment
                     SET serial_number = serial_number - 1,
                         updated_at = NOW()
                     WHERE doctor_id = $1
                       AND appointment_date = $2
                       AND serial_number > $3
                       AND status IN ('booked', 'late', 'in_progress');`,
                    [doctor_id, appointment_date, serial_number]
                );
            }

            const result = await client.query(
                `SELECT * FROM appointment WHERE appointment_id = $1;`,
                [appointmentId]
            );
            return result.rows[0] || null;
        });
    };

    markAppointmentLate = async (appointmentId, doctorId) => {
        const query = `
            UPDATE appointment
            SET status = 'late',
                priority_flag = TRUE,
                priority_reason = 'late',
                updated_at = NOW()
            WHERE appointment_id = $1
              AND doctor_id = $2
              AND status = 'booked'
            RETURNING *;
        `;
        const result = await this.db_connection.query_executor(query, [appointmentId, doctorId]);
        return result.rows[0] || null;
    };

    markAppointmentArrived = async (appointmentId, doctorId) => {
        const query = `
            UPDATE appointment
            SET arrival_time = NOW(),
                updated_at = NOW()
            WHERE appointment_id = $1
              AND doctor_id = $2
              AND status IN ('booked', 'late')
            RETURNING *;
        `;
        const result = await this.db_connection.query_executor(query, [appointmentId, doctorId]);
        return result.rows[0] || null;
    };

    startAppointment = async (appointmentId, doctorId) => {
        const query = `
            UPDATE appointment
            SET status = 'in_progress',
                seen_at = NOW(),
                updated_at = NOW()
            WHERE appointment_id = $1
              AND doctor_id = $2
              AND status IN ('booked', 'late')
            RETURNING *;
        `;
        const result = await this.db_connection.query_executor(query, [appointmentId, doctorId]);
        return result.rows[0] || null;
    };

    completeAppointment = async (appointmentId, doctorId) => {
        const query = `
            UPDATE appointment
            SET status = 'completed',
                updated_at = NOW()
            WHERE appointment_id = $1
              AND doctor_id = $2
              AND status IN ('booked', 'late', 'in_progress')
            RETURNING *;
        `;
        const result = await this.db_connection.query_executor(query, [appointmentId, doctorId]);
        return result.rows[0] || null;
    };
}

module.exports = AppointmentModel;
