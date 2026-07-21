const router = require("express").Router();
const calorieController = require("../../controllers/calorie.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/calorie.validator");

/**
 * @swagger
 * tags:
 *   name: Calorie
 *   description: Daily calorie target calculation and history
 */

/**
 * @swagger
 * /calorie/calculate:
 *   post:
 *     summary: Calculate BMR/TDEE and a goal-adjusted daily calorie target
 *     tags: [Calorie]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Calorie target calculated }
 */
router.post(
  "/calculate",
  authenticate,
  validate(schemas.calculate),
  calorieController.calculate
);

/**
 * @swagger
 * /calorie/history:
 *   get:
 *     summary: List the current user's past calorie calculations (paginated)
 *     tags: [Calorie]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Calorie history retrieved }
 */
router.get("/history", authenticate, validate(schemas.history), calorieController.history);

module.exports = router;
