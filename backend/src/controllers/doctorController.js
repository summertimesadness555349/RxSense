const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DoctorModel = require('../models/doctorModel.js');
const LLMUtils = require('../utils/llmUtils.js');
const PatientModel = require('../models/patientModel.js');

class DoctorController {
    constructor() {
        this.doctorModel = new DoctorModel();
        this.llmUtils = new LLMUtils();
        this.patientModel = new PatientModel();
        this.salt_round = parseInt(process.env.PASSWORD_SALT_ROUNDS || '13');
        this.access_token_secret = process.env.JWT_ACCESS_SECRET;
        this.refresh_token_secret = process.env.JWT_REFRESH_SECRET;
        this.access_token_expiry = process.env.ACCESS_TOKEN_TTL || '30m';
        this.refresh_token_expiry = process.env.REFRESH_TOKEN_DAYS || '30d';
    }

    normalizeDate = (dateValue) => {
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return dateValue;
        }
        if (dateValue) {
            const parsed = new Date(dateValue);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed.toISOString().slice(0, 10);
            }
        }
        return new Date().toISOString().slice(0, 10);
    };

    parseTimeToMinutes = (timeValue) => {
        if (!timeValue || typeof timeValue !== 'string') return null;
        const match = timeValue.match(/^(\d{2}):(\d{2})/);
        if (!match) return null;
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
        return hours * 60 + minutes;
    };

    generateTokens = (doctor) => {
        const accessPayload = {
            sub: doctor.doctor_id,
            username: doctor.username,
            email: doctor.email,
            role: 'doctor'
        };

        const accessToken = jwt.sign(accessPayload, this.access_token_secret, { expiresIn: this.access_token_expiry });
        // Refresh token contains doctor ID
        const refreshToken = jwt.sign({ sub: doctor.doctor_id }, this.refresh_token_secret, { expiresIn: this.refresh_token_expiry });

        return { accessToken, refreshToken };
    };

    register = async (req, res) => {
        try {
            console.log('Doctor registration request body:', req.body);
            const { name, specialty, licenseNumber, gender, username, email, password } = req.body;
            if (!name || !licenseNumber || !username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Name, License Number, Username, Email, and Password are required'
                });
            }

            // Check if username/email/license number are taken
            const existingByUsername = await this.doctorModel.getDoctorByUsername(username);
            console.log('Existing doctor with username check:', existingByUsername);
            if (existingByUsername) {
                return res.status(409).json({ success: false, error: 'Username already taken' });
            }

            const existingByEmail = await this.doctorModel.getDoctorByEmail(email);
            console.log('Existing doctor with email check:', existingByEmail);
            if (existingByEmail) {
                return res.status(409).json({ success: false, error: 'Email already in use' });
            }

            const existingByLicense = await this.doctorModel.getDoctorByLicenseNumber(licenseNumber);
            console.log('Existing doctor with license number check:', existingByLicense);
            if (existingByLicense) {
                return res.status(409).json({ success: false, error: 'License number already registered' });
            }

            const passwordHash = await bcrypt.hash(password, this.salt_round);
            const newDoctor = await this.doctorModel.createDoctor({
                name,
                specialty,
                licenseNumber,
                gender,
                username,
                email,
                password: passwordHash
            });

            return res.status(201).json({
                success: true,
                message: 'Doctor account registered successfully',
                doctor: newDoctor
            });
        } catch (error) {
            console.error('Doctor registration error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error during registration' });
        }
    };

    login = async (req, res) => {
        try {
            const { identifier, password } = req.body;
            if (!identifier || !password) {
                return res.status(400).json({ success: false, error: 'Identifier (Username/Email) and Password are required' });
            }

            let doctor = await this.doctorModel.getDoctorByUsername(identifier);
            if (!doctor && identifier.includes('@')) {
                doctor = await this.doctorModel.getDoctorByEmail(identifier);
            }

            if (!doctor) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, doctor.password);
            if (!isMatch) {
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            // Record last login
            await this.doctorModel.setLastLogin(doctor.doctor_id);

            const { accessToken, refreshToken } = this.generateTokens(doctor);

            // TODO: In the future, we can add a table or column to track active refresh tokens for doctors if needed.
            // For now, we return tokens and doctor profile.

            return res.status(200).json({
                success: true,
                message: 'Login successful',
                doctor: {
                    doctor_id: doctor.doctor_id,
                    name: doctor.name,
                    specialty: doctor.specialty,
                    license_number: doctor.license_number,
                    gender: doctor.gender,
                    username: doctor.username,
                    email: doctor.email,
                    daily_patient_limit: doctor.daily_patient_limit,
                },
                tokens: { accessToken, refreshToken }
            });
        } catch (error) {
            console.error('Doctor login error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error during login' });
        }
    };

    getProfile = async (req, res) => {
        try {
            // req.doctor is populated by authenticateDoctor middleware
            return res.status(200).json({
                success: true,
                doctor: req.doctor
            });
        } catch (error) {
            console.error('Get doctor profile error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };     

    updateProfile = async (req, res) => {
    try {
        const { email,specialty, gender, username, currentPassword } = req.body || {};
        const doctorId = req.doctor.doctor_id;

        // 1. Password Verification Guard Clause
        if (!currentPassword) {
            return res.status(400).json({ success: false, error: 'Current password is required to make identifier changes' });
        }

        // Fetch doctor record to get the saved password hash
        const doctor = await this.doctorModel.getDoctorByUsername(req.doctor.username);
        if (!doctor) {
            return res.status(404).json({ success: false, error: 'Doctor profile not found' });
        }


        // Verify the password
        const isPasswordValid = await bcrypt.compare(currentPassword, doctor.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid current password' });
        }

        const updates = {};
        updates.specialty = specialty !== undefined ? specialty : doctor.specialty;
        updates.name = req.body.name !== undefined ? req.body.name : doctor.name;

        // 2. Process Gender Update
        if (gender !== undefined) {
            updates.gender = gender;
        }

        // 3. Process Username Update
        if (username !== undefined && username !== req.doctor.username) {
            const existingByUsername = await this.doctorModel.getDoctorByUsername(username);
            if (existingByUsername && existingByUsername.doctor_id !== doctorId) {
                return res.status(409).json({ success: false, error: 'Username already taken' });
            }
            updates.username = username;
        }

        // 4. Process Email Update
        if (email !== undefined && email !== req.doctor.email) {
            const existingByEmail = await this.doctorModel.getDoctorByEmail(email);
            if (existingByEmail && existingByEmail.doctor_id !== doctorId) {
                return res.status(409).json({ success: false, error: 'Email already in use' });
            }
            updates.email = email;
        }

        // 5. Guard clause if fields were passed but values didn't actually change
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No changes provided' });
        }

        // 6. Save updates to database
        const updatedDoctor = await this.doctorModel.updateDoctor(doctorId, updates);

        return res.status(200).json({
            success: true,
            message: 'Profile identifiers updated successfully',
            doctor: updatedDoctor
        });
    } catch (error) {
        console.error('Change identifier error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

    changePassword = async (req, res) => {
        try {
            const { oldPassword, newPassword } = req.body;
            const doctorId = req.doctor.doctor_id;

            if (!oldPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Old password and new password are required'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be at least 6 characters long'
                });
            }

            // Fetch doctor with password hash
            const doctor = await this.doctorModel.getDoctorByUsername(req.doctor.username);
            if (!doctor) {
                return res.status(404).json({
                    success: false,
                    error: 'Doctor not found'
                });
            }

            const isOldPasswordValid = await bcrypt.compare(oldPassword, doctor.password);
            if (!isOldPasswordValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid old password'
                });
            }

            const isSameOldPassword = await bcrypt.compare(newPassword, doctor.password);
            if (isSameOldPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'New password must be different from old password'
                });
            }

            const hashedNewPassword = await bcrypt.hash(newPassword, this.salt_round);
            await this.doctorModel.updateDoctor(doctorId, { password: hashedNewPassword });

            return res.status(200).json({
                success: true,
                message: 'Password changed successfully'
            });
        } catch (error) {
            console.error('Doctor change password error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };

    // Hospital Affiliations
    addAffiliation = async (req, res) => {
        try {
            const doctorId = req.doctor.doctor_id;
            const { hospitalId, role, isPrimary } = req.body;
            if (!hospitalId || !role) {
                return res.status(400).json({ success: false, error: 'hospitalId and role are required' });
            }

            const affiliation = await this.doctorModel.addHospitalAffiliation(doctorId, hospitalId, role, !!isPrimary);
            return res.status(201).json({
                success: true,
                message: 'Hospital affiliation successfully created',
                affiliation
            });
        } catch (error) {
            console.error('Add affiliation error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getAffiliations = async (req, res) => {
        try {
            const doctorId = req.doctor.doctor_id;
            const affiliations = await this.doctorModel.getHospitalAffiliations(doctorId);
            return res.status(200).json({
                success: true,
                affiliations
            });
        } catch (error) {
            console.error('Get affiliations error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    // Patient Queries
    getPatients = async (req, res) => {
        try {
            const requestedDate = this.normalizeDate(req.query?.date);
            const patients = await this.doctorModel.getPatientsByAppointmentDate(req.doctor.doctor_id, requestedDate);
            return res.status(200).json({
                success: true,
                patients
            });
        } catch (error) {
            console.error('Get patients list error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getAppointments = async (req, res) => {
        try {
            const requestedDate = this.normalizeDate(req.query?.date);
            const appointments = await this.doctorModel.getAppointmentsByDate(req.doctor.doctor_id, requestedDate);
            return res.status(200).json({
                success: true,
                appointments
            });
        } catch (error) {
            console.error('Get appointments error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    updateDailyLimit = async (req, res) => {
        try {
            const { dailyPatientLimit } = req.body || {};

            const updates = {};
            if (dailyPatientLimit !== undefined) {
                const limitValue = Number(dailyPatientLimit);
                if (!Number.isFinite(limitValue) || limitValue < 1) {
                    return res.status(400).json({ success: false, error: 'dailyPatientLimit must be a positive number' });
                }
                updates.daily_patient_limit = limitValue;
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ success: false, error: 'No update parameters provided' });
            }

            const updatedDoctor = await this.doctorModel.updateDoctor(req.doctor.doctor_id, updates);

            let effectiveDate = null;
            // console.log(`[updateDailyLimit] doctorId=${req.doctor.doctor_id} newLimit=${updates.daily_patient_limit} checking for effective date...`);
            if (updates.daily_patient_limit !== undefined) {
                effectiveDate = await this.doctorModel.findFirstAvailableDate(req.doctor.doctor_id, updates.daily_patient_limit);
                console.log(`[updateDailyLimit] doctorId=${req.doctor.doctor_id} newLimit=${updates.daily_patient_limit} effectiveDate=${effectiveDate}`);
            }

            return res.status(200).json({
                success: true,
                doctor: updatedDoctor,
                effectiveDate,
            });
        } catch (error) {
            console.error('Update daily limit error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getAvailability = async (req, res) => {
        try {
            const requestedDate = this.normalizeDate(req.query?.date);
            const availability = await this.doctorModel.getAvailabilityByDate(req.doctor.doctor_id, requestedDate);
            return res.status(200).json({ success: true, availability });
        } catch (error) {
            console.error('Get availability error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    setAvailability = async (req, res) => {
        try {
            const { date, startTime, endTime, dailyLimit } = req.body || {};

            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
                return res.status(400).json({ success: false, error: 'date must be YYYY-MM-DD' });
            }

            const startMinutes = this.parseTimeToMinutes(startTime);
            const endMinutes = this.parseTimeToMinutes(endTime);
            if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
                return res.status(400).json({ success: false, error: 'Invalid availability time range' });
            }

            let limitValue = null;
            if (dailyLimit !== undefined && dailyLimit !== null && String(dailyLimit).trim() !== '') {
                limitValue = Number(dailyLimit);
                if (!Number.isFinite(limitValue) || limitValue < 1) {
                    return res.status(400).json({ success: false, error: 'dailyLimit must be a positive number' });
                }
            }

            const availability = await this.doctorModel.upsertAvailability({
                doctorId: req.doctor.doctor_id,
                availabilityDate: date,
                startTime,
                endTime,
                dailyLimit: limitValue,
            });

            return res.status(200).json({
                success: true,
                availability,
                message: `Availability active from ${date} onwards. Dates with existing bookings retain their original times.`,
            });
        } catch (error) {
            if (error.code === 'SCHEDULE_LOCKED') {
                return res.status(409).json({
                    success: false,
                    error: error.message || 'Time changes only apply to future dates without bookings.',
                });
            }
            if (error.code === 'LIMIT_LOCKED') {
                return res.status(409).json({ success: false, error: 'Daily limit cannot be set below booked appointments' });
            }
            console.error('Set availability error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    markAppointmentLate = async (req, res) => {
        try {
            const { appointmentId } = req.params;
            const updated = await this.doctorModel.updateAppointment(appointmentId, req.doctor.doctor_id, {
                status: 'late',
                priority_flag: true,
                priority_reason: 'late',
                updated_at: new Date().toISOString(),
            });
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
            }
            return res.status(200).json({ success: true, appointment: updated });
        } catch (error) {
            console.error('Mark appointment late error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    markAppointmentArrived = async (req, res) => {
        try {
            const { appointmentId } = req.params;
            const updated = await this.doctorModel.updateAppointment(appointmentId, req.doctor.doctor_id, {
                arrival_time: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
            }
            return res.status(200).json({ success: true, appointment: updated });
        } catch (error) {
            console.error('Mark appointment arrived error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    startAppointment = async (req, res) => {
        try {
            const { appointmentId } = req.params;
            const updated = await this.doctorModel.updateAppointment(appointmentId, req.doctor.doctor_id, {
                status: 'in_progress',
                seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
            }
            return res.status(200).json({ success: true, appointment: updated });
        } catch (error) {
            console.error('Start appointment error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    completeAppointment = async (req, res) => {
        try {
            const { appointmentId } = req.params;
            const updated = await this.doctorModel.updateAppointment(appointmentId, req.doctor.doctor_id, {
                status: 'completed',
                updated_at: new Date().toISOString(),
            });
            if (!updated) {
                return res.status(404).json({ success: false, error: 'Appointment not found or not eligible' });
            }
            return res.status(200).json({ success: true, appointment: updated });
        } catch (error) {
            console.error('Complete appointment error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getPatientChart = async (req, res) => {
        try {
            const { patientId } = req.params;
            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            // Gathers patient chart details
            const conditions = await this.doctorModel.getPatientConditions(patientId);
            const surgeries = await this.doctorModel.getPatientSurgeries(patientId);
            const vaccinations = await this.doctorModel.getPatientVaccinations(patientId);
            const allergies = await this.doctorModel.getPatientAllergies(patientId);
            const activePrescriptions = await this.doctorModel.getPatientActivePrescriptions(patientId);
            const reports = await this.doctorModel.getPatientReports(patientId);

            // Fetch metrics for each lab report
            for (const r of reports) {
                r.metrics = await this.patientModel.getReportMetrics(r.report_id);
            }

            // Fetch self-reported symptom logs and AI risk assessments
            const symptomLogs = await this.patientModel.getTimelineSymptoms(patientId, 100);

            console.log(`[getPatientChart] patientId=${patientId} conditions=${conditions.length} prescriptions=${activePrescriptions.length} reports=${reports.length}`);

            return res.status(200).json({
                success: true,
                patient,
                chart: {
                    conditions,
                    surgeries,
                    vaccinations,
                    allergies,
                    activePrescriptions,
                    reports,
                    symptomLogs
                }
            });
        } catch (error) {
            console.error('Get patient chart error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    // Drug Autocomplete API
    searchDrugs = async (req, res) => {
        try {
            const { q } = req.query;
            if (!q) {
                return res.status(400).json({ success: false, error: 'Search term query parameter (q) is required' });
            }
            const drugs = await this.doctorModel.searchDrugs(q);
            return res.status(200).json({
                success: true,
                drugs
            });
        } catch (error) {
            console.error('Drug search error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    addPatientAllergy = async (req, res) => {
        try {
            const { patientId } = req.params;
            const { drugId, reactionType, severity, confirmedAt } = req.body || {};

            if (!drugId || !reactionType || !severity) {
                return res.status(400).json({
                    success: false,
                    error: 'drugId, reactionType, and severity are required'
                });
            }

            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const allergy = await this.doctorModel.createPatientAllergy(patientId, req.doctor.doctor_id, {
                drugId,
                reactionType,
                severity,
                confirmedAt: confirmedAt || null,
            });

            return res.status(201).json({
                success: true,
                message: 'Allergy added successfully',
                allergy
            });
        } catch (error) {
            if (error.code === '23505') {
                return res.status(409).json({ success: false, error: 'Allergy already exists for this patient' });
            }
            console.error('Add patient allergy error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    addPatientVaccination = async (req, res) => {
        try {
            const { patientId } = req.params;
            const {
                vaccineName,
                cvxCode,
                doseNumber,
                totalDoses,
                administeredAt,
                batchNumber,
                site,
                nextDueDate,
                notes,
                hospitalId,
            } = req.body || {};

            if (!vaccineName) {
                return res.status(400).json({ success: false, error: 'vaccineName is required' });
            }

            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const vaccination = await this.doctorModel.createPatientVaccination(patientId, req.doctor.doctor_id, {
                vaccineName,
                cvxCode,
                doseNumber,
                totalDoses,
                administeredAt: administeredAt || null,
                batchNumber,
                site,
                nextDueDate,
                notes,
                hospitalId,
            });

            return res.status(201).json({
                success: true,
                message: 'Vaccination added successfully',
                vaccination
            });
        } catch (error) {
            console.error('Add patient vaccination error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    addPatientSurgery = async (req, res) => {
        try {
            const { patientId } = req.params;
            const {
                procedureName,
                icd10Pcs,
                performedAt,
                outcome,
                complications,
                anaesthesiaType,
                notes,
                hospitalId,
            } = req.body || {};

            if (!procedureName) {
                return res.status(400).json({ success: false, error: 'procedureName is required' });
            }

            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const surgery = await this.doctorModel.createPatientSurgery(patientId, req.doctor.doctor_id, {
                procedureName,
                icd10Pcs,
                performedAt: performedAt || null,
                outcome,
                complications,
                anaesthesiaType,
                notes,
                hospitalId,
            });

            return res.status(201).json({
                success: true,
                message: 'Surgery added successfully',
                surgery
            });
        } catch (error) {
            console.error('Add patient surgery error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    // safety checks helpers
    gatherSafetyDetails = async (patientId, proposedDrugItems) => {
        const allergies = await this.doctorModel.getPatientAllergies(patientId);
        const activePrescriptions = await this.doctorModel.getPatientActivePrescriptions(patientId);
        const surgeries = await this.doctorModel.getPatientSurgeries(patientId);
        const vaccinations = await this.doctorModel.getPatientVaccinations(patientId);

        // Flatten active prescription items
        const currentMedications = [];
        for (const rx of activePrescriptions) {
            if (rx.items && rx.items.length > 0) {
                currentMedications.push(
                    ...rx.items.filter((item) => String(item.status || 'active').toLowerCase() === 'active')
                );
            }
        }

        // Fetch full drug profiles for proposed items
        const proposedMedications = [];
        for (const item of proposedDrugItems.filter((item) => String(item.status || 'active').toLowerCase() === 'active')) {
            const drug = await this.doctorModel.getDrugById(item.drug_id);
            if (drug) {
                proposedMedications.push({
                    ...drug,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    status: 'active'
                });
            }
        }

        return { allergies, currentMedications, proposedMedications, surgeries, vaccinations };
    }



    //TODO:
     //Use checkPrescriptionSafety for interactive feedback while the doctor is drafting the prescription.
     //Use createPrescription for secure write operations and permanent audit logging when the doctor clicks "Finalize/Submit".



     

    checkPrescriptionSafety = async (req, res) => {
        try {
            const { patientId } = req.params;
            const { items } = req.body; // Array of { drug_id, dosage, frequency }

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: 'Proposed prescription items array is required' });
            }

            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const { allergies, currentMedications, proposedMedications, surgeries, vaccinations } = await this.gatherSafetyDetails(patientId, items);

            const safetyReport = await this.llmUtils.checkPrescriptionSafety(
                patientId,
                allergies,
                currentMedications,
                proposedMedications,
                surgeries,
                vaccinations
            );

            return res.status(200).json({
                success: true,
                safetyReport
            });
        } catch (error) {
            console.error('Prescription safety check error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    createPrescription = async (req, res) => {
        try {
            const { patientId } = req.params;
            const doctorId = req.doctor.doctor_id;
            const { items, ...draftData } = req.body; // Extract items and the rest as draftData

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: 'Prescription items array is required' });
            }

            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            // 1. Gather patient details and run the safety check
            const { allergies, currentMedications, proposedMedications, surgeries, vaccinations } = await this.gatherSafetyDetails(patientId, items);
            const safetyReport = await this.llmUtils.checkPrescriptionSafety(
                patientId,
                allergies,
                currentMedications,
                proposedMedications,
                surgeries,
                vaccinations
            );

            // 2. Create the prescription record in DB with clinical notes
            const prescription = await this.doctorModel.createPrescription(patientId, doctorId, draftData);

            // 3. Add items to the prescription
            const createdItems = [];
            for (const item of items) {
                const addedItem = await this.doctorModel.addPrescriptionItem(
                    prescription.prescription_id,
                    item.drug_id,
                    item.dosage,
                    item.frequency,
                    item.duration_days || 7,
                    item.instructions || 'Take as directed'
                );
                createdItems.push(addedItem);
            }

            // 4. Update prescription with LLM check results
            const alertText = safetyReport.has_conflict ? JSON.stringify(safetyReport.warnings) : null;
            const updatedPrescription = await this.doctorModel.updatePrescriptionLLMCheck(
                prescription.prescription_id,
                true, // checked
                alertText
            );

            return res.status(201).json({
                success: true,
                message: safetyReport.has_conflict
                    ? 'Prescription created with safety warnings. Please check safety logs.'
                    : 'Prescription created successfully.',
                prescription: {
                    ...updatedPrescription,
                    items: createdItems
                },
                safetyReport
            });
        } catch (error) {
            console.error('Create prescription error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };
    getPausedOrStoppedMedicine = async (req, res) => {
        try {
            const { patientId } = req.params;
            const pausedMedications = await this.doctorModel.getPausedMedicineByPatientId(patientId);
            // console.log(pausedMedications);
            return res.status(200).json({
                success: true,
                pausedMedications
            });
        } catch (error) {
            console.error('Get paused medications error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    modifyPrescriptionItem = async (req, res) => {
        try {
            const { patientId, itemId } = req.params;
            const { status, pause_duration_days, modification_notes } = req.body;
            if (!status || !["active", "paused", "stopped"].includes(status)) {
                return res.status(400).json({ success: false, error: 'Status must be active, paused, or stopped' });
            }

            // Check if patient exists
            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }
            if(status === "paused" && !pause_duration_days && isNaN(parseInt(pause_duration_days))) {
                return res.status(400).json({ success: false, error: 'Pause duration days is required when status is paused' });
            }
            let activeItem = null;
            if(status === "stopped" || status === "paused") {
                const activePrescriptions = await this.doctorModel.getPatientActivePrescriptions(patientId);
                for(const rx of activePrescriptions){
                    if(rx.items && rx.items.length > 0){
                        const found = rx.items.find(i => String(i.item_id) === String(itemId));
                        if(found){
                            activeItem = found;
                            break;
                        }
                    }
                }
                if(!activeItem){
                    return res.status(404).json({ success: false, error: 'Active prescription item not found for stopping or pausing' });
                }
            }

            const durationDays = pause_duration_days;
            const notes = modification_notes ? `Modification notes: ${modification_notes}` : null;
            // console.log(`[modifyPrescriptionItem] patientId=${patientId} itemId=${itemId} status=${status} durationDays=${durationDays} notes=${notes}`);

            if (activeItem?.source === 'prescription_scan') {
                if (status !== 'stopped') {
                    return res.status(400).json({ success: false, error: 'Scanned medicines can only be shortened from this action' });
                }

                const shortenedDurationDays = 0;

                const updatedScan = await this.doctorModel.updatePrescriptionScanMedicationDuration(
                    patientId,
                    itemId,
                    shortenedDurationDays,
                    notes || null
                );

                if (!updatedScan) {
                    return res.status(404).json({ success: false, error: 'Prescription scan medication not found' });
                }

                return res.status(200).json({
                    success: true,
                    message: `Medication duration shortened to ${shortenedDurationDays} days`,
                    item: updatedScan
                });
            }

            // Update status in DB
            const updatedItem = await this.doctorModel.updatePrescriptionItemStatus(
                patientId,
                itemId,
                status,
                status === "paused" ? parseInt(durationDays) || null : null,
                notes || null
            );

            if (!updatedItem) {
                return res.status(404).json({ success: false, error: 'Prescription item not found' });
            }

            return res.status(200).json({
                success: true,
                message: `Medication successfully marked as ${status}`,
                item: updatedItem
            });
        } catch (error) {
            console.error('Modify prescription item error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };

    getAllHospitals = async (req, res) => {
        try {
            const hospitals = await this.doctorModel.getAllHospitals();
            return res.status(200).json({
                success: true,
                hospitals
            });
        } catch (error) {
            console.error('Get hospitals list error:', error);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
    };
}

module.exports = DoctorController;
