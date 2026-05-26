const express = require('express');
const PatientController = require('../controllers/patientController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');

// essential modules
const patientRouter = express.Router();
const patientController = new PatientController();
const authenticateToken = new AuthenticateToken();

patientRouter.use(authenticateToken.authenticateToken);

// patientRouter.post('/reports/analyze', patientController.getProfile);

/**
 * @openapi
 * /api/patient/me:
 *   get:
 *     tags: [Patient]
 *     summary: Get the current patient's profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Patient profile
 *       401:
 *         description: Unauthorized
 */
patientRouter.get('/me', patientController.getProfile);

/**
 * @openapi
 * /api/patient/profile/{patientId}:
 *   get:
 *     tags: [Patient]
 *     summary: Get a patient profile by id
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Patient profile
 *       404:
 *         description: Patient not found
 */
patientRouter.get('/profile/:patientId', upload.single('report'), patientController.analyzeReport);

module.exports = {
    patientRouter
};


module.exports = {patientRouter};