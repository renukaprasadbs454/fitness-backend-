const router = require("express").Router();
const workoutController = require("../../controllers/workout.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/workout.validator");
const { ROLES } = require("../../constants/roles");

/**
 * @swagger
 * tags:
 *   name: Workouts
 *   description: Workout plans, exercise library, and recommendations
 */

// ── Static/specific routes MUST come before the /:id catch-all ──

/**
 * @swagger
 * /workouts/recommended:
 *   get:
 *     summary: Get personalized workout plan recommendations (BMI + goal based)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Recommended workouts retrieved }
 */
router.get("/recommended", authenticate, workoutController.recommended);

/**
 * @swagger
 * /workouts/exercises:
 *   get:
 *     summary: List the exercise library (paginated, searchable)
 *     tags: [Workouts]
 *     responses:
 *       200: { description: Exercises retrieved }
 */
router.get("/exercises", validate(schemas.listExercises), workoutController.listExercises);

/**
 * @swagger
 * /workouts/exercises:
 *   post:
 *     summary: Create an exercise (admin only)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Exercise created }
 */
router.post(
  "/exercises",
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(schemas.createExercise),
  workoutController.createExercise
);

/**
 * @swagger
 * /workouts/exercises/{id}:
 *   put:
 *     summary: Update an exercise (admin only)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Exercise updated }
 */
router.put(
  "/exercises/:id",
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(schemas.updateExercise),
  workoutController.updateExercise
);

/**
 * @swagger
 * /workouts/exercises/{id}:
 *   delete:
 *     summary: Delete an exercise (admin only)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Exercise deleted }
 */
router.delete(
  "/exercises/:id",
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(schemas.idParam),
  workoutController.deleteExercise
);

/**
 * @swagger
 * /workouts:
 *   get:
 *     summary: List workout plans (filterable by category/difficulty, paginated)
 *     tags: [Workouts]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: difficulty
 *         schema: { type: string }
 *     responses:
 *       200: { description: Workout plans retrieved }
 */
router.get("/", validate(schemas.listPlans), workoutController.listPlans);

/**
 * @swagger
 * /workouts:
 *   post:
 *     summary: Create a workout plan (admin only)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Workout plan created }
 */
router.post(
  "/",
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(schemas.createPlan),
  workoutController.createPlan
);

/**
 * @swagger
 * /workouts/{id}:
 *   get:
 *     summary: Get a workout plan by id, including its exercises
 *     tags: [Workouts]
 *     responses:
 *       200: { description: Workout plan retrieved }
 *       404: { description: Not found }
 */
router.get("/:id", validate(schemas.idParam), workoutController.getPlanById);

/**
 * @swagger
 * /workouts/{id}:
 *   put:
 *     summary: Update a workout plan (admin only)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Workout plan updated }
 */
router.put(
  "/:id",
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(schemas.updatePlan),
  workoutController.updatePlan
);

/**
 * @swagger
 * /workouts/{id}:
 *   delete:
 *     summary: Delete a workout plan (admin only)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Workout plan deleted }
 */
router.delete(
  "/:id",
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(schemas.idParam),
  workoutController.deletePlan
);

/**
 * @swagger
 * /workouts/{id}/complete:
 *   post:
 *     summary: Mark a workout plan as completed (feeds progress + activity feed)
 *     tags: [Workouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Workout marked complete }
 */
router.post(
  "/:id/complete",
  authenticate,
  validate(schemas.idParam),
  workoutController.completePlan
);

module.exports = router;
