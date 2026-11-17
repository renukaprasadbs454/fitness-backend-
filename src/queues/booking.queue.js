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
        const notificationService = require("../services/notification.service");
        const { userId, title, body, appointmentId } = data;
        await notificationService.notify(userId, "APPOINTMENT_REMINDER", title, body, {
          data: { appointmentId },
        });
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

async function enqueueAppointmentReminder(userId, title, body, appointmentId, delay) {
  const queue = getBookingQueue();
  await queue.add("reminder", {
    type: "APPOINTMENT_REMINDER",
    data: { userId, title, body, appointmentId },
  }, { delay });
}

module.exports = { getBookingQueue, startBookingWorker, enqueuePostBookingTasks, enqueueAppointmentReminder };
