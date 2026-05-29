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
                    email: doctor.email
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
            const { name, specialty, gender, username, email } = req.body || {};
            const doctorId = req.doctor.doctor_id;

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (specialty !== undefined) updates.specialty = specialty;
            if (gender !== undefined) updates.gender = gender;

            if (username !== undefined && username !== req.doctor.username) {
                const existing = await this.doctorModel.getDoctorByUsername(username);
                if (existing && existing.doctor_id !== doctorId) {
                    return res.status(409).json({ success: false, error: 'Username already taken' });
                }
                updates.username = username;
            }

            if (email !== undefined && email !== req.doctor.email) {
                const existing = await this.doctorModel.getDoctorByEmail(email);
                if (existing && existing.doctor_id !== doctorId) {
                    return res.status(409).json({ success: false, error: 'Email already in use' });
                }
                updates.email = email;
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ success: false, error: 'No valid updates provided' });
            }

            const updatedDoctor = await this.doctorModel.updateDoctor(doctorId, updates);
            return res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                doctor: updatedDoctor
            });
        } catch (error) {
            console.error('Update doctor profile error:', error);
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
            const patients = await this.doctorModel.getAllPatients();
            return res.status(200).json({
                success: true,
                patients
            });
        } catch (error) {
            console.error('Get patients list error:', error);
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

    // safety checks helpers
    gatherSafetyDetails = async (patientId, proposedDrugItems) => {
        const allergies = await this.doctorModel.getPatientAllergies(patientId);
        const activePrescriptions = await this.doctorModel.getPatientActivePrescriptions(patientId);

        // Flatten active prescription items
        const currentMedications = [];
        for (const rx of activePrescriptions) {
            if (rx.items && rx.items.length > 0) {
                currentMedications.push(...rx.items);
            }
        }

        // Fetch full drug profiles for proposed items
        const proposedMedications = [];
        for (const item of proposedDrugItems) {
            const drug = await this.doctorModel.getDrugById(item.drug_id);
            if (drug) {
                proposedMedications.push({
                    ...drug,
                    dosage: item.dosage,
                    frequency: item.frequency
                });
            }
        }

        return { allergies, currentMedications, proposedMedications };
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

            const { allergies, currentMedications, proposedMedications } = await this.gatherSafetyDetails(patientId, items);

            const safetyReport = await this.llmUtils.checkPrescriptionSafety(
                patientId,
                allergies,
                currentMedications,
                proposedMedications
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
            const { items } = req.body; // Array of { drug_id, dosage, frequency, duration_days, instructions }

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({ success: false, error: 'Prescription items array is required' });
            }

            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            // 1. Gather patient details and run the safety check
            const { allergies, currentMedications, proposedMedications } = await this.gatherSafetyDetails(patientId, items);
            const safetyReport = await this.llmUtils.checkPrescriptionSafety(
                patientId,
                allergies,
                currentMedications,
                proposedMedications
            );

            // 2. Create the prescription record in DB
            const prescription = await this.doctorModel.createPrescription(patientId, doctorId);

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

    modifyPrescriptionItem = async (req, res) => {
        try {
            const { patientId, itemId } = req.params;
            const { status, pauseDurationDays, pause_duration_days, modificationNotes, modification_notes } = req.body;

            if (!status || !['active', 'paused', 'stopped'].includes(status)) {
                return res.status(400).json({ success: false, error: 'Status must be active, paused, or stopped' });
            }

            // Check if patient exists
            const patient = await this.doctorModel.getPatientById(patientId);
            if (!patient) {
                return res.status(404).json({ success: false, error: 'Patient not found' });
            }

            const durationDays = pauseDurationDays !== undefined ? pauseDurationDays : pause_duration_days;
            const notes = modificationNotes !== undefined ? modificationNotes : modification_notes;

            // Update status in DB
            const updatedItem = await this.doctorModel.updatePrescriptionItemStatus(
                patientId,
                itemId,
                status,
                status === 'paused' ? parseInt(durationDays) || null : null,
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
