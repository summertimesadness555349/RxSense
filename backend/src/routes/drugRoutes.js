const express = require('express');
const router = express.Router();
const { checkInteractions, checkNewMedInteractions } = require('../controllers/drugController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');
const authenticateToken = new AuthenticateToken();

router.post('/interactions', checkInteractions);
router.post('/newmedinteractions/:patientId', authenticateToken.authenticateToken, checkNewMedInteractions);

module.exports = { drugRouter: router };