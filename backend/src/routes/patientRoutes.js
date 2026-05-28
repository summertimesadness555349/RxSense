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

patientRouter.get('/me',
    authenticateToken.authenticateToken,
    patientController.getProfile
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

patientRouter.post('/reports/chat',
    authenticateToken.authenticateToken,
    reportChatController.chat
);

patientRouter.get('/timeline',
    authenticateToken.authenticateToken,
    patientController.getTimeline
);

module.exports = { patientRouter };
