const patientModel = require('../models/patientModel');

class PatientController {
    constructor() {
        this.patientModel = new patientModel();
    }

}

module.exports = PatientController;