const express = require('express');
const PatientController = require('../controllers/patientController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');
const multer = require('multer');
const upload = multer({storage: multer.memoryStorage()});

// essential modules
const patientRouter = express.Router();
const patientController = new PatientController();
const authenticateToken = new AuthenticateToken();

patientRouter.post('/reports/analyze', upload.single('report'), patientController.analyzeReport);

module.exports = {
    patientRouter
};
