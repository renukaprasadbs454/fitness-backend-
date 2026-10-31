const router = require("express").Router();
const customWorkoutController = require("../../controllers/customWorkout.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/customWorkout.validator");

/**
 * @swagger
 * tags:
 *   name: CustomWorkouts
 *   description: User-authored custom workouts (private to the creating user)
 */

// Every route is per-user private data — authenticated only, no role
// restriction (any USER/COACH/ADMIN can have their own), never cached.

/**
 * @swagger
 * /custom-workouts:
 *   get:
 *     summary: List the current user's custom workouts
 *     tags: [CustomWorkouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Custom workouts retrieved }
 */
router.get("/", authenticate, customWorkoutController.list);

/**
 * @swagger
 * /custom-workouts:
 *   post:
 *     summary: Create a custom workout
 *     tags: [CustomWorkouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Custom workout created }
 */
router.post(
  "/",
  authenticate,
  validate(schemas.createCustomWorkout),
  customWorkoutController.create
);

/**
 * @swagger
 * /custom-workouts/{id}:
 *   get:
 *     summary: Get one of the current user's custom workouts by id
 *     tags: [CustomWorkouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Custom workout retrieved }
 *       404: { description: Not found }
 */
router.get("/:id", authenticate, validate(schemas.idParam), customWorkoutController.getById);

/**
 * @swagger
 * /custom-workouts/{id}:
 *   put:
 *     summary: Update one of the current user's custom workouts
 *     tags: [CustomWorkouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Custom workout updated }
 */
router.put(
  "/:id",
  authenticate,
  validate(schemas.updateCustomWorkout),
  customWorkoutController.update
);

router.post("/:id/complete", authenticate, validate(schemas.idParam), customWorkoutController.complete);

/**
 * @swagger
 * /custom-workouts/{id}:
 *   delete:
 *     summary: Delete one of the current user's custom workouts
 *     tags: [CustomWorkouts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Custom workout deleted }
 */
router.delete("/:id", authenticate, validate(schemas.idParam), customWorkoutController.remove);

module.exports = router;
