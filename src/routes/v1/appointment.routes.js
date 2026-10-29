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
 * /appointments/meeting-status:
 *   get:
 *     summary: Whether sessions can get an automatically generated Google Meet link
 *     tags: [Appointments]
 *     responses:
 *       200: { description: "{ googleMeetConnected: boolean }" }
 */
router.get("/meeting-status", authenticate, appointmentController.meetingStatus);

/**
 * @swagger
 * /appointments/sessions/clients:
 *   get:
 *     summary: "Coach: the clients you can schedule sessions with"
 *     description: Clients assigned to you, plus anyone with a booked or completed session with you since any coach swap. canScheduleAnyone is true for the head coach, who can also schedule with any other client.
 *     tags: [Appointments]
 *     responses:
 *       200: { description: "{ clients: [{ id, fullName, email, username, assigned }], canScheduleAnyone: boolean }" }
 */
router.get("/sessions/clients", authenticate, requireRole(ROLES.COACH), appointmentController.schedulableClients);

/**
 * @swagger
 * /appointments/sessions:
 *   post:
 *     summary: "Coach: schedule a session (or a weekly series) with one of your clients"
 *     description: Sessions are created CONFIRMED. Each gets its own Google Meet link when the platform Google account is connected, unless meetingLink is given. Clashing slots are skipped and listed in the response.
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, title, scheduledAt]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               coachId: { type: string, format: uuid, description: "Head coach only: the coach this session is with (defaults to you)" }
 *               title: { type: string, example: "1:1 coaching session" }
 *               scheduledAt: { type: string, format: date-time }
 *               durationMinutes: { type: integer, example: 45 }
 *               notes: { type: string }
 *               repeatWeeks: { type: integer, minimum: 0, maximum: 11, description: "Extra weekly sessions after the first" }
 *               meetingLink: { type: string, example: "https://meet.google.com/abc-defg-hij" }
 *     responses:
 *       201: { description: Sessions scheduled }
 */
router.post(
  "/sessions",
  authenticate,
  requireRole(ROLES.COACH),
  validate(schemas.scheduleSessions),
  appointmentController.scheduleSessions
);

/**
 * @swagger
 * /appointments/{id}/meeting-link:
 *   patch:
 *     summary: "Coach/admin: set or clear (null) a session's meeting link"
 *     tags: [Appointments]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meetingLink: { type: string, nullable: true, example: "https://meet.google.com/abc-defg-hij" }
 *     responses:
 *       200: { description: Meeting link saved }
 * /appointments/{id}/meeting-link/generate:
 *   post:
 *     summary: "Coach/admin: create a unique Google Meet link for this session via the platform Google account"
 *     tags: [Appointments]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Google Meet link created }
 *       400: { description: Platform Google account not connected }
 */
router.patch("/:id/meeting-link", authenticate, validate(schemas.setMeetingLink), appointmentController.setMeetingLink);
router.post(
  "/:id/meeting-link/generate",
  authenticate,
  validate(schemas.idParam),
  appointmentController.generateMeetingLink
);

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
