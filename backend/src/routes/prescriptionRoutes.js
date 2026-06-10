const express = require('express');
const multer = require('multer');
const PrescriptionController = require('../controllers/prescriptionController.js');
const ChatController          = require('../controllers/chatController.js');
const AuthenticateToken       = require('../middlewares/authenticateToken.js');

const prescriptionRouter      = express.Router();
const prescriptionController  = new PrescriptionController();
const chatController          = new ChatController();
const authenticateToken       = new AuthenticateToken();
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

/**
 * @openapi
 * /api/prescription/history:
 *   get:
 *     tags: [Prescription]
 *     summary: Get prescription scan history for the authenticated user
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200:
 *         description: List of prescription scans
 */
prescriptionRouter.get(
    '/history',
    authenticateToken.authenticateToken,
    prescriptionController.getPrescriptionHistory
);

/**
 * @openapi
 * /api/prescription/save/{scanId}:
 *   patch:
 *     tags: [Prescription]
 *     summary: Attach a prescription scan to the authenticated patient's profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Scan updated successfully
 *       400:
 *         description: Missing scan id or patient identity
 *       404:
 *         description: Prescription scan not found
 */
prescriptionRouter.patch(
    '/update/:scanId',
    authenticateToken.authenticateToken,
    prescriptionController.updatePrescriptionScan
);

prescriptionRouter.patch(
    '/save/:scanId',
    authenticateToken.authenticateToken,
    prescriptionController.savePrescriptionScan
);

/**
 * @openapi
 * /api/prescription/remove/{scanId}:
 *   patch:
 *     tags: [Prescription]
 *     summary: Detach a prescription scan from any patient profile
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Scan updated successfully
 *       400:
 *         description: Missing scan id
 *       404:
 *         description: Prescription scan not found
 */
prescriptionRouter.patch(
    '/remove/:scanId',
    authenticateToken.authenticateToken,
    prescriptionController.removePrescriptionScan
);

/**
 * @openapi
 * /api/prescription/delete/{scanId}:
 *   delete:
 *     tags: [Prescription]
 *     summary: Permanently delete a prescription scan from the database
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Scan deleted successfully
 *       400:
 *         description: Missing scan id
 *       404:
 *         description: Prescription scan not found
 */
prescriptionRouter.delete(
    '/delete/:scanId',
    authenticateToken.authenticateToken,
    prescriptionController.deletePrescriptionScan
);

/**
 * @openapi
 * /api/prescription/chat:
 *   post:
 *     tags: [Prescription]
 *     summary: Chat about a prescription using AI + DrugBank context
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:    { type: string }
 *               prescription: { type: object }
 *               messages:    { type: array }
 */
prescriptionRouter.post(
    '/chat',
    authenticateToken.authenticateToken,
    chatController.chat
);

module.exports = { prescriptionRouter };
