const appointmentRepository = require("../repositories/appointment.repository");

async function upcoming(userId) {
  const appointments = await appointmentRepository.upcomingForUser(userId, 20);

  return appointments.map((a) => ({
    id: a.id,
    type: "APPOINTMENT",
    title: a.title,
    coach: a.coach?.user?.fullName || null,
    scheduledAt: a.scheduledAt,
    durationMinutes: a.durationMinutes,
    status: a.status
  }));
}

module.exports = { upcoming };
