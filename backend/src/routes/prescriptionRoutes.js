const express = require('express');
const multer = require('multer');
const PrescriptionController = require('../controllers/prescriptionController.js');
const AuthenticateToken = require('../middlewares/authenticateToken.js');

const prescriptionRouter = express.Router();
const prescriptionController = new PrescriptionController();
const authenticateToken = new AuthenticateToken();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/prescription/analyze:
 *   post:
 *     tags: [Prescription]
 *     summary: Analyze a prescription image
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Extracted drug list
 *       400:
 *         description: No image provided
 *       500:
 *         description: Analysis error
 */
prescriptionRouter.post(
    '/analyze',
    authenticateToken.authenticateToken,
    upload.single('image'),
    prescriptionController.analyzePrescription
);

module.exports = { prescriptionRouter };
