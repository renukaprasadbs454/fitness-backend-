const router = require("express").Router();
const workoutAssignmentController = require("../../controllers/workoutAssignment.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/workoutAssignment.validator");

/**
 * @swagger
 * tags:
 *   name: WorkoutAssignments
 *   description: Coaches (to their assigned users) and admins (to anyone) sending a workout to a user
 */

/**
 * @swagger
 * /workout-assignments/search-users:
 *   get:
 *     summary: Search users to assign a workout to (coaches see only their assigned users; admins see all)
 *     tags: [WorkoutAssignments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Users retrieved }
 */
router.get("/search-users", authenticate, validate(schemas.searchUsers), workoutAssignmentController.searchUsers);

/**
 * @swagger
 * /workout-assignments/{userId}/plan:
 *   post:
 *     summary: Assign a catalog workout plan to another user
 *     tags: [WorkoutAssignments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Workout assigned }
 */
router.post(
  "/:userId/plan",
  authenticate,
  validate(schemas.assignWorkoutPlan),
  workoutAssignmentController.assignWorkoutPlan
);

/**
 * @swagger
 * /workout-assignments/{userId}/custom:
 *   post:
 *     summary: Build and assign a custom workout to another user
 *     tags: [WorkoutAssignments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Workout assigned }
 */
router.post(
  "/:userId/custom",
  authenticate,
  validate(schemas.assignCustomWorkout),
  workoutAssignmentController.assignCustomWorkout
);

/**
 * @swagger
 * /workout-assignments/mine:
 *   get:
 *     summary: List workouts the current user has assigned to others
 *     tags: [WorkoutAssignments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assigned workouts retrieved }
 */
router.get(
  "/mine",
  authenticate,
  validate(schemas.listMyAssignedWorkouts),
  workoutAssignmentController.listMyAssignedWorkouts
);

/**
 * @swagger
 * /workout-assignments/{id}:
 *   patch:
 *     summary: Update a workout plan assignment's note/schedule (sender or recipient)
 *     tags: [WorkoutAssignments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assigned workout updated }
 */
router.patch(
  "/:id",
  authenticate,
  validate(schemas.updateAssignedWorkoutPlan),
  workoutAssignmentController.updateAssignedWorkoutPlan
);

/**
 * @swagger
 * /workout-assignments/{id}:
 *   delete:
 *     summary: Remove a workout plan assignment (sender or recipient)
 *     tags: [WorkoutAssignments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Assigned workout removed }
 */
router.delete("/:id", authenticate, validate(schemas.idParam), workoutAssignmentController.unassignWorkoutPlan);

module.exports = router;
