const { getQueue, registerWorker } = require("../config/queue");
const logger = require("../config/logger");

const QUEUE_NAME = "bookings";

function getBookingQueue() {
  return getQueue(QUEUE_NAME);
}

function startBookingWorker(appointmentService, app) {
  registerWorker(QUEUE_NAME, async (job) => {
    const { type, data } = job.data;

    switch (type) {
      case "POST_BOOKING_TASKS": {
        // Runs the side-effects (meet link, activity feed, chat) that
        // don't need to block the booking HTTP response.
        const { appointmentId, userId, coachId, title, coachName } = data;
        const activityFeed = require("../services/activityFeed.service");
        const chatService = require("../services/chat.service");
        const meetingService = require("../services/meeting.service");
        const appointmentRepository = require("../repositories/appointment.repository");

        // Auto-generate Google Meet link
        const appointment = await appointmentRepository.findById(appointmentId);
        if (appointment && !appointment.meetingLink && (await meetingService.isConnected())) {
          try {
            const meeting = await meetingService.createMeetLink(appointment);
            await appointmentRepository.updateMeeting(appointmentId, { ...meeting, meetingProvider: "GOOGLE_MEET" });
          } catch (err) {
            logger.warn(`[booking-queue] Meet link failed for ${appointmentId}: ${err.message}`);
          }
        }

        // Activity feed
        await activityFeed.record(userId, "APPOINTMENT_BOOKED", `Booked ${title} with ${coachName}`);

        // Booking chat message
        try {
          const sent = await chatService.sendBookingMessage(userId, coachId);
          if (sent) {
            const emitter = app?.get("chatSocketEmitter");
            if (emitter) emitter(userId, sent.message);
          }
        } catch (err) {
          logger.warn(`[booking-queue] Chat message failed: ${err.message}`);
        }
        break;
      }

      case "APPOINTMENT_REMINDER": {
        const { sendAppointmentReminder } = require("../jobs/appointmentReminder.job");
        let scheduledAt = data.scheduledAt;
        // Jobs queued before this validation was added carry no expected
        // appointment time. Recover them only when the current confirmed
        // session is still within its reminder window.
        if (!scheduledAt) {
          const appointmentRepository = require("../repositories/appointment.repository");
          const appointment = await appointmentRepository.findById(data.appointmentId);
          const now = Date.now();
          const startsAt = appointment ? new Date(appointment.scheduledAt).getTime() : 0;
          if (!appointment || appointment.status !== "CONFIRMED" || startsAt <= now || startsAt > now + 60 * 60 * 1000) {
            break;
          }
          scheduledAt = appointment.scheduledAt;
        }
        await sendAppointmentReminder(data.appointmentId, scheduledAt);
        break;
      }

      default:
        logger.warn(`[booking-queue] Unknown job type: ${type}`);
    }
  }, { concurrency: 5 });
}

async function enqueuePostBookingTasks(appointmentId, userId, coachId, title, coachName) {
  const queue = getBookingQueue();
  await queue.add("post-booking", {
    type: "POST_BOOKING_TASKS",
    data: { appointmentId, userId, coachId, title, coachName },
  });
}

async function enqueueAppointmentReminder(appointmentId, scheduledAt, delay) {
  const queue = getBookingQueue();
  const scheduledTime = new Date(scheduledAt);
  await queue.add("reminder", {
    type: "APPOINTMENT_REMINDER",
    data: { appointmentId, scheduledAt: scheduledTime.toISOString() },
  }, {
    delay: Math.max(0, delay),
    jobId: `appointment-reminder-${appointmentId}-${scheduledTime.getTime()}`
  });
}

module.exports = { getBookingQueue, startBookingWorker, enqueuePostBookingTasks, enqueueAppointmentReminder };
