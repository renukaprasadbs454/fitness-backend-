const router = require("express").Router();
const appointmentController = require("../../controllers/appointment.controller");
const { authenticate } = require("../../middlewares/auth.middleware");
const validate = require("../../middlewares/validate.middleware");
const schemas = require("../../validators/appointment.validator");

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
 *       409: { description: Coach already booked for that slot }
 */
router.post(
  "/",
  authenticate,
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

module.exports = router;
