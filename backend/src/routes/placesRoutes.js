'use strict';

const express           = require('express');
const PlacesController  = require('../controllers/placesController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');

const placesRouter     = express.Router();
const placesController = new PlacesController();
const auth             = new AuthenticateToken();

placesRouter.get('/nearby',          auth.authenticateToken, placesController.nearbySearch);
placesRouter.get('/geocode',         auth.authenticateToken, placesController.geocode);
placesRouter.post('/infer-specialty', auth.authenticateToken, placesController.inferSpecialty);

module.exports = { placesRouter };
