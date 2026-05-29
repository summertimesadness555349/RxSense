const express = require('express');
const router = express.Router();
const { checkInteractions } = require('../controllers/drugController.js');

router.post('/interactions', checkInteractions);

module.exports = { drugRouter: router };
