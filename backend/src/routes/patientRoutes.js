const express              = require('express');
const PatientController    = require('../controllers/patientController.js');
const ReportChatController = require('../controllers/reportChatController.js');
const AuthenticateToken    = require('../middlewares/authenticateToken.js');
const multer               = require('multer');
const upload               = multer({ storage: multer.memoryStorage() });

const patientRouter        = express.Router();
const patientController    = new PatientController();
const reportChatController = new ReportChatController();
const authenticateToken    = new AuthenticateToken();

patientRouter.post('/me/medication-safety',
    authenticateToken.authenticateToken,
    patientController.medicationSafetyCheck
);

patientRouter.get('/me',
    authenticateToken.authenticateToken,
    patientController.getProfile
);

patientRouter.put('/me',
    authenticateToken.authenticateToken,
    patientController.updateProfile
);

patientRouter.get('/me/health-summary',
    authenticateToken.authenticateToken,
    patientController.getHealthSummary
);

patientRouter.get('/me/documents',
    authenticateToken.authenticateToken,
    patientController.getDocuments
);

patientRouter.get('/me/active-medications',
    authenticateToken.authenticateToken,
    patientController.getActiveMedications
);

patientRouter.get('/doctors',
    authenticateToken.authenticateToken,
    patientController.listDoctors
);

patientRouter.get('/doctors/:doctorId/availability',
    authenticateToken.authenticateToken,
    patientController.getDoctorAvailability
);

patientRouter.post('/appointments',
    authenticateToken.authenticateToken,
    patientController.bookAppointment
);

patientRouter.get('/appointments',
    authenticateToken.authenticateToken,
    patientController.getAppointments
);

patientRouter.patch('/appointments/:appointmentId/arrive',
    authenticateToken.authenticateToken,
    patientController.markArrival
);

patientRouter.patch('/appointments/:appointmentId/cancel',
    authenticateToken.authenticateToken,
    patientController.cancelAppointment
);

patientRouter.get('/profile/:patientId',
    authenticateToken.authenticateToken,
    patientController.getProfile
);

patientRouter.post('/reports/analyze',
    authenticateToken.authenticateToken,
    upload.single('report'),
    patientController.analyzeReport
);

patientRouter.get('/reports/history',
    authenticateToken.authenticateToken,
    patientController.getReportHistory
);

patientRouter.post('/reports/chat',
    authenticateToken.authenticateToken,
    reportChatController.chat
);

patientRouter.patch('/reports/save/:reportId',
    authenticateToken.authenticateToken,
    patientController.saveReport
);

patientRouter.patch('/reports/remove/:reportId',
    authenticateToken.authenticateToken,
    patientController.removeReport
);

patientRouter.delete('/reports/delete/:reportId',
    authenticateToken.authenticateToken,
    patientController.deleteReport
);

patientRouter.get('/timeline',
    authenticateToken.authenticateToken,
    patientController.getTimeline
);

module.exports = { patientRouter };
