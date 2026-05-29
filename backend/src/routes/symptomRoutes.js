'use strict';

const express            = require('express');
const SymptomController  = require('../controllers/symptomController.js');
const AuthenticateToken  = require('../middlewares/authenticateToken.js');

const symptomRouter      = express.Router();
const symptomController  = new SymptomController();
const authenticateToken  = new AuthenticateToken();

symptomRouter.post('/check', authenticateToken.authenticateToken, symptomController.check);

module.exports = { symptomRouter };
