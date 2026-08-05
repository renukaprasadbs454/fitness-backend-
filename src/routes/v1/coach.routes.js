const router = require("express").Router();
const coachController = require("../../controllers/coach.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/coach.validator");
const { ROLES } = require("../../constants/roles");
const { cacheResponse, invalidate } = require("../../middlewares/cache.middleware");

const CACHE_PREFIX = "/api/v1/coaches";

/**
 * @swagger
 * tags:
 *   name: Coaches
 *   description: Coach profile CRUD and availability
 */

/**
 * @swagger
 * /coaches:
 *   get:
 *     summary: List coaches (paginated, filterable by specialty)
 *     tags: [Coaches]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: specialty
 *         schema: { type: string }
 *     responses:
 *       200: { description: Coaches retrieved }
 */
router.get("/", cacheResponse(60), validate(schemas.listCoaches), coachController.listCoaches);

/**
 * @swagger
 * /coaches/me:
 *   get:
 *     summary: Get the logged-in coach's own profile
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach profile retrieved }
 */
router.get("/me", authenticate, requireRole(ROLES.COACH), coachController.getMyCoachProfile);

/**
 * @swagger
 * /coaches/me:
 *   put:
 *     summary: Update the logged-in coach's own profile
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach profile updated }
 */
router.put(
  "/me",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.createOrUpdateCoach),
  coachController.updateMyCoachProfile
);

/**
 * @swagger
 * /coaches/me:
 *   delete:
 *     summary: Delete the logged-in coach's own profile
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Coach profile deleted }
 */
router.delete("/me", invalidate(CACHE_PREFIX), authenticate, requireRole(ROLES.COACH), coachController.deleteMyCoachProfile);

/**
 * @swagger
 * /coaches/{id}:
 *   get:
 *     summary: Get a coach's public profile by id
 *     tags: [Coaches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Coach retrieved }
 *       404: { description: Coach not found }
 */
router.get("/:id", cacheResponse(60), validate(schemas.idParam), coachController.getCoachById);

/**
 * @swagger
 * /coaches/{coachId}/availability:
 *   get:
 *     summary: List a coach's availability slots
 *     tags: [Coaches]
 *     responses:
 *       200: { description: Availability retrieved }
 */
router.get("/:coachId/availability", cacheResponse(60), coachController.listAvailability);

/**
 * @swagger
 * /coaches/{coachId}/availability:
 *   post:
 *     summary: Create or update an availability slot (coach only, own profile)
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Availability slot upserted }
 *       403: { description: Not your coach profile }
 */
router.post(
  "/:coachId/availability",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.upsertAvailability),
  coachController.upsertAvailability
);

module.exports = router;
