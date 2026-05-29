'use strict';

const express            = require('express');
const InsightsController = require('../controllers/insightsController.js');
const AuthenticateToken  = require('../middlewares/authenticateToken.js');

const insightsRouter     = express.Router();
const insightsController = new InsightsController();
const authenticateToken  = new AuthenticateToken();

// GET  /api/insights          — generate (or serve cached) health insights
// GET  /api/insights?force=true — bypass cache and regenerate
insightsRouter.get('/',
    authenticateToken.authenticateToken,
    insightsController.getInsights
);

// POST /api/insights/patient-summary — warm patient-facing health narrative
insightsRouter.post('/patient-summary',
    authenticateToken.authenticateToken,
    insightsController.getPatientSummary
);

// POST /api/insights/doctor-summary — on-demand doctor-facing summary
insightsRouter.post('/doctor-summary',
    authenticateToken.authenticateToken,
    insightsController.getDoctorSummary
);

module.exports = { insightsRouter };
