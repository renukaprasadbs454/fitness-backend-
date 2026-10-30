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
 * /coaches/{id}:
 *   put:
 *     summary: "Head coach: edit another coach's profile (bio, specialties, experience, accepting clients)"
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Coach profile updated }
 *       403: { description: Only the head coach can edit another coach }
 */
router.put(
  "/:id",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.updateCoachProfile),
  coachController.updateCoachProfile
);

/**
 * @swagger
 * /coaches:
 *   post:
 *     summary: "Head coach: make an existing user a coach (or update their coach profile)"
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid, description: "Promote this existing user. Leave out to create a brand-new coach account instead." }
 *               fullName: { type: string, description: "New account: the coach's name" }
 *               email: { type: string, description: "New account: login email" }
 *               phone: { type: string, description: "New account: optional" }
 *               password: { type: string, description: "New account: at least 8 characters with an uppercase letter, a lowercase letter and a number" }
 *               bio: { type: string }
 *               specialties: { type: array, items: { type: string } }
 *               experienceYears: { type: integer }
 *               isAcceptingClients: { type: boolean }
 *     responses:
 *       201: { description: Coach added }
 *       403: { description: Only the head coach can add coaches }
 * /coaches/{id}:
 *   delete:
 *     summary: "Head coach: remove a coach (their account becomes a regular user)"
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Coach removed }
 *       403: { description: Only the head coach can remove coaches (and not the head coach) }
 */
router.post(
  "/",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.createCoachByHead),
  coachController.createCoach
);
router.delete(
  "/:id",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.idParam),
  coachController.deleteCoach
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
 * /coaches/me/appointments:
 *   get:
 *     summary: List appointments booked with the logged-in coach (as the coach, not the booker)
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, COMPLETED, CANCELLED] }
 *     responses:
 *       200: { description: Appointments retrieved }
 */
/**
 * @swagger
 * /coaches/me/clients:
 *   get:
 *     summary: "Coach: your clients, each with the coach they are assigned to (head coach: every client)"
 *     description: relation is mine (assigned to you), booked (booked with you), other (head coach view - assigned to another coach) or unassigned.
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "{ clients: [...], summary: { total, mine, booked, other, unassigned } }" }
 */
router.get("/me/clients", authenticate, requireRole(ROLES.COACH), coachController.listMyClients);

router.get(
  "/me/appointments",
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.listMyAppointments),
  coachController.listMyAppointments
);

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

/**
 * @swagger
 * /coaches/{coachId}/availability/{slotId}:
 *   put:
 *     summary: Edit an availability slot (day, start, end or active). Own profile, or any coach for the head coach.
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Slot updated }
 *       403: { description: Not your coach profile }
 *       404: { description: Slot not found }
 *       409: { description: Another slot already starts then }
 *   delete:
 *     summary: Delete an availability slot. Own profile, or any coach for the head coach.
 *     tags: [Coaches]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Slot deleted }
 *       403: { description: Not your coach profile }
 *       404: { description: Slot not found }
 */
router.put(
  "/:coachId/availability/:slotId",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.updateAvailabilitySlot),
  coachController.updateAvailabilitySlot
);
router.delete(
  "/:coachId/availability/:slotId",
  invalidate(CACHE_PREFIX),
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.deleteAvailabilitySlot),
  coachController.deleteAvailabilitySlot
);

module.exports = router;
