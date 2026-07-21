const router = require("express").Router();
const bmiController = require("../../controllers/bmi.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/bmi.validator");

/**
 * @swagger
 * tags:
 *   name: BMI
 *   description: BMI calculation and history
 */

/**
 * @swagger
 * /bmi/calculate:
 *   post:
 *     summary: Calculate and store a BMI entry
 *     tags: [BMI]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [heightCm, weightKg]
 *             properties:
 *               heightCm: { type: number }
 *               weightKg: { type: number }
 *     responses:
 *       201: { description: BMI calculated }
 */
router.post("/calculate", authenticate, validate(schemas.calculate), bmiController.calculate);

/**
 * @swagger
 * /bmi/history:
 *   get:
 *     summary: List the current user's past BMI calculations (paginated)
 *     tags: [BMI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: BMI history retrieved }
 */
router.get("/history", authenticate, validate(schemas.history), bmiController.history);

module.exports = router;
