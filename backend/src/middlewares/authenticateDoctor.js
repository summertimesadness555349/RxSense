const jwt = require('jsonwebtoken');
const DoctorModel = require('../models/doctorModel.js');

class AuthenticateDoctor {
    constructor() {
        this.doctorModel = new DoctorModel();
        this.access_token_secret = process.env.JWT_ACCESS_SECRET;
    }

    authenticateDoctor = async (req, res, next) => {
        try {
            console.log("Authenticating doctor...");

            const authHeader = req.headers['authorization'] || req.headers['Authorization'];
            const token = authHeader && authHeader.split(' ')[1];

            if (!token) {
                console.log("Doctor access token not provided");
                return res.status(401).json({
                    success: false,
                    message: "Access token required"
                });
            }

            console.log("Verifying doctor token...");
            const decoded = jwt.verify(token, this.access_token_secret);
            const doctorId = decoded.sub || decoded.id;
            
            // Check that the token is actually for a doctor (role must be doctor, or we can check the db doctor table)
            const doctor = await this.doctorModel.getDoctorById(doctorId);

            if (!doctor) {
                return res.status(401).json({
                    success: false,
                    message: "Doctor account not found or access denied"
                });
            }

            req.doctor = doctor;
            // Also set req.user to allow logging and other generic middlewares to work
            req.user = {
                id: doctor.doctor_id,
                username: doctor.username,
                email: doctor.email,
                role: 'doctor'
            };

            next();
        } catch (error) {
            console.error('Doctor token verification error:', error.message);

            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token expired'
                });
            }
            return res.status(403).json({
                success: false,
                message: 'Invalid token'
            });
        }
    };
}

module.exports = AuthenticateDoctor;
