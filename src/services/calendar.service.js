const appointmentRepository = require("../repositories/appointment.repository");
const workoutRepository = require("../repositories/workout.repository");

async function upcoming(userId) {
  const [appointments, scheduledWorkouts] = await Promise.all([
    appointmentRepository.upcomingForUser(userId, 20),
    workoutRepository.upcomingScheduleForUser(userId, 20)
  ]);

  const appointmentItems = appointments.map((a) => ({
    id: a.id,
    type: "APPOINTMENT",
    title: a.title,
    coach: a.coach?.user?.fullName || null,
    scheduledAt: a.scheduledAt,
    durationMinutes: a.durationMinutes,
    status: a.status
  }));

  const workoutItems = scheduledWorkouts.map((w) => ({
    id: w.id,
    type: "WORKOUT",
    title: w.plan.title,
    coach: null,
    scheduledAt: w.scheduledAt,
    durationMinutes: w.plan.durationMinutes,
    status: w.status
  }));

  return [...appointmentItems, ...workoutItems]
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 20);
}

module.exports = { upcoming };
