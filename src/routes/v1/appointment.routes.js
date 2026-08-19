const router = require("express").Router();
const appointmentController = require("../../controllers/appointment.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/role.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/appointment.validator");
const { ROLES } = require("../../constants/roles");

/**
 * @swagger
 * tags:
 *   name: Appointments
 *   description: Coach appointment booking and management
 */

/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Book an appointment with a coach (validates availability + conflicts)
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Appointment booked }
 *       403: { description: Coaches cannot book appointments }
 *       409: { description: Coach already booked for that slot }
 */
router.post(
  "/",
  authenticate,
  requireRole(ROLES.USER, ROLES.ADMIN),
  validate(schemas.createAppointment),
  appointmentController.create
);

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: List the current user's appointments (paginated, filterable by status)
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, CONFIRMED, COMPLETED, CANCELLED] }
 *     responses:
 *       200: { description: Appointments retrieved }
 */
router.get("/", authenticate, validate(schemas.listAppointments), appointmentController.list);

/**
 * @swagger
 * /appointments/{id}:
 *   get:
 *     summary: Get an appointment by id
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Appointment retrieved }
 */
router.get("/:id", authenticate, validate(schemas.idParam), appointmentController.getById);

/**
 * @swagger
 * /appointments/{id}/status:
 *   patch:
 *     summary: Update appointment status (owner can cancel; coach/admin can confirm/complete/cancel)
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Appointment status updated }
 */
router.patch(
  "/:id/status",
  authenticate,
  validate(schemas.updateStatus),
  appointmentController.updateStatus
);

/**
 * @swagger
 * /appointments/{id}/reschedule:
 *   patch:
 *     summary: Reschedule an appointment (validates availability + conflicts)
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Appointment rescheduled }
 *       409: { description: Coach already booked for that slot }
 */
router.patch(
  "/:id/reschedule",
  authenticate,
  validate(schemas.rescheduleAppointment),
  appointmentController.reschedule
);

/**
 * @swagger
 * /appointments/{id}:
 *   patch:
 *     summary: Edit an appointment's title/notes (owner, coach on the appointment, or admin)
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Appointment updated }
 */
router.patch(
  "/:id",
  authenticate,
  validate(schemas.updateAppointmentDetails),
  appointmentController.updateDetails
);

/**
 * @swagger
 * /appointments/{id}:
 *   delete:
 *     summary: Permanently delete a cancelled or completed appointment
 *     tags: [Appointments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Appointment deleted }
 *       400: { description: Only cancelled or completed appointments can be deleted }
 */
router.delete(
  "/:id",
  authenticate,
  validate(schemas.idParam),
  appointmentController.remove
);

module.exports = router;
