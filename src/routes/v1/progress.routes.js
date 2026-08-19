const router = require("express").Router();
const progressController = require("../../controllers/progress.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const upload = require("../../middlewares/upload.middleware");
const schemas = require("../../validators/progress.validator");

/**
 * @swagger
 * tags:
 *   name: Progress
 *   description: Weight logs, body measurements, progress photos, and reports
 */

/**
 * @swagger
 * /progress/weight:
 *   post:
 *     summary: Log a weight entry
 *     tags: [Progress]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Weight logged }
 */
router.post("/weight", authenticate, validate(schemas.logWeight), progressController.logWeight);

/**
 * @swagger
 * /progress/measurements:
 *   post:
 *     summary: Log body measurements (chest, waist, hip, arm, thigh)
 *     tags: [Progress]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Measurement logged }
 */
router.post(
  "/measurements",
  authenticate,
  validate(schemas.logMeasurement),
  progressController.logMeasurement
);

/**
 * @swagger
 * /progress/photo:
 *   post:
 *     summary: Upload a progress photo
 *     tags: [Progress]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *               angle: { type: string, enum: [FRONT, BACK, LEFT, RIGHT] }
 *               sessionId: { type: string }
 *     responses:
 *       201: { description: Progress photo uploaded }
 */
router.post(
  "/photo",
  authenticate,
  upload.single("file"),
  validate(schemas.logPhoto),
  progressController.logPhoto
);

/**
 * @swagger
 * /progress/photo-sessions:
 *   get:
 *     summary: List past transformation-photo upload sessions, newest first
 *     tags: [Progress]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Progress photo sessions retrieved }
 */
router.get("/photo-sessions", authenticate, progressController.photoSessions);

/**
 * @swagger
 * /progress/report:
 *   get:
 *     summary: Weekly/monthly progress report (weight trend, BMI trend, stats, timeline)
 *     tags: [Progress]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: range
 *         schema: { type: string, enum: [weekly, monthly] }
 *     responses:
 *       200: { description: Progress report retrieved }
 */
router.get("/report", authenticate, validate(schemas.report), progressController.report);

module.exports = router;
