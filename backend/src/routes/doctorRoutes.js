const express = require('express');
const DoctorController = require('../controllers/doctorController.js');
const AuthenticateDoctor = require('../middlewares/authenticateDoctor.js');

const doctorRouter = express.Router();
const doctorController = new DoctorController();
const authenticateDoctor = new AuthenticateDoctor();


doctorRouter.post('/register', doctorController.register);
doctorRouter.post('/login', doctorController.login);

doctorRouter.use(authenticateDoctor.authenticateDoctor); 

doctorRouter.get('/hospitals-list', doctorController.getAllHospitals);
doctorRouter.get('/get-profile/:doctorId', doctorController.getProfile);
doctorRouter.patch('/update-profile/:doctorId', doctorController.updateProfile);
doctorRouter.post('/change-password/:doctorId', doctorController.changePassword);
doctorRouter.post('/hospitals/:doctorId', doctorController.addAffiliation);
doctorRouter.get('/hospitals/:doctorId', doctorController.getAffiliations);
doctorRouter.get('/patients', doctorController.getPatients);
doctorRouter.get('/patients/:patientId', doctorController.getPatientChart);
doctorRouter.post('/patients/:patientId/check-safety', doctorController.checkPrescriptionSafety);
doctorRouter.post('/patients/:patientId/prescriptions', doctorController.createPrescription);
doctorRouter.post('/patients/:patientId/allergies', doctorController.addPatientAllergy);
doctorRouter.post('/patients/:patientId/vaccinations', doctorController.addPatientVaccination);
doctorRouter.post('/patients/:patientId/surgeries', doctorController.addPatientSurgery);
doctorRouter.patch('/patients/:patientId/prescription-items/:itemId', doctorController.modifyPrescriptionItem);
doctorRouter.get('/drugs/search', doctorController.searchDrugs);

module.exports = { doctorRouter };
