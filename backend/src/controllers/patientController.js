const patientModel = require('../models/patientModel');

class PatientController {
    constructor() {
        this.patientModel = new patientModel();
    }

    getProfile = async (req, res) => {
        try {
            console.log('Get patient profile request by user:', req.user);
            const patientId = req.user?.id || req.params.patientId || req.user?.patient_id;

            if (!patientId) {
                return res.status(400).json({
                    success: false,
                    error: 'patientId is required'
                });
            }

            const patient = await this.patientModel.getPatientProfile({ patientId });

            if (!patient) {
                return res.status(404).json({
                    success: false,
                    error: 'Patient not found'
                });
            }

            return res.status(200).json({
                success: true,
                user: patient
            });
        } catch (error) {
            console.error('Get patient profile error:', error);
            return res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

}

module.exports = PatientController;