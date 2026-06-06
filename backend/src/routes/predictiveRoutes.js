'use strict';

const express = require('express');
const PredictiveController = require('../controllers/predictiveController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');

const predictiveRouter = express.Router();
const predictiveController = new PredictiveController();
const authenticateToken = new AuthenticateToken();

predictiveRouter.get(
    '/',
    authenticateToken.authenticateToken,
    predictiveController.getPredictions
);

predictiveRouter.get(
    '/trends/:metricName',
    authenticateToken.authenticateToken,
    predictiveController.getMetricTrend
);

predictiveRouter.post(
    '/refresh',
    authenticateToken.authenticateToken,
    predictiveController.refreshPredictions
);

predictiveRouter.post(
    '/compute-trends',
    authenticateToken.authenticateToken,
    predictiveController.computeTrends
);

module.exports = { predictiveRouter };
