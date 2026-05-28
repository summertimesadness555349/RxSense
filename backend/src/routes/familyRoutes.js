'use strict';

const express            = require('express');
const FamilyController   = require('../controllers/familyController.js');
const AuthenticateToken  = require('../middlewares/authenticateToken.js');

const familyRouter       = express.Router();
const familyController   = new FamilyController();
const authenticateToken  = new AuthenticateToken();
const auth               = authenticateToken.authenticateToken;

familyRouter.get('/my-code',               auth, familyController.getMyCode);
familyRouter.post('/my-code/regenerate',   auth, familyController.regenerateCode);
familyRouter.post('/lookup',               auth, familyController.lookupCode);
familyRouter.post('/link',                 auth, familyController.linkMember);
familyRouter.get('/members',               auth, familyController.getMembers);
familyRouter.get('/members/:linkId/health',auth, familyController.getMemberHealth);
familyRouter.delete('/link/:linkId',       auth, familyController.removeLink);

module.exports = { familyRouter };
