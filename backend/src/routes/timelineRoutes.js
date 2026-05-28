const express = require('express');
const TimelineController = require('../controllers/timelineController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');

const timelineRouter = express.Router();
const timelineController = new TimelineController();
const authenticateToken = new AuthenticateToken();

// GET /api/timeline/:userId
// Returns timeline entries in the same shape as frontend mockTimeline.js
timelineRouter.get(
    '/:userId',
    authenticateToken.authenticateToken,
    timelineController.getTimeline
);

module.exports = { timelineRouter };
