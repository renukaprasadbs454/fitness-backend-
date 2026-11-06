const customWorkoutRepository = require("../repositories/customWorkout.repository");
const prisma = require("../database/prismaClient");
const ApiError = require("../utils/ApiError");

function toDto(workout) {
  const latestCompletion = workout.completions?.[0];
  const todayKey = new Date().toISOString().slice(0, 10);
  const isRecurring = workout.scheduleType === "DAILY" || workout.scheduleType === "WEEKLY";
  const completionDate = latestCompletion?.completionDate?.toISOString().slice(0, 10);
  const completedAt = isRecurring
    ? (completionDate === todayKey ? latestCompletion.completedAt : null)
    : (workout.completedAt ?? latestCompletion?.completedAt ?? null);
  return {
    id: workout.id,
    title: workout.title,
    description: workout.description,
    durationMinutes: workout.durationMinutes,
    difficulty: workout.difficulty,
    categoryKey: workout.categoryKey,
    accentColor: workout.accentColor,
    imageUrl: workout.imageUrl,
    videoUrl: workout.videoUrl,
    isAvailable: workout.isAvailable,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
    completedAt,
    scheduledAt: workout.scheduledAt ?? null,
    scheduleType: workout.scheduleType ?? "ONCE",
    scheduleDays: workout.scheduleDays ?? [],
    assignedBy: workout.assignedByUser ? { id: workout.assignedByUser.id, fullName: workout.assignedByUser.fullName } : null,
    exercises: workout.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
      imageUrl: e.imageUrl ?? null,
      videoUrl: e.videoUrl ?? null,
      sets: e.sets,
      reps: e.reps
    }))
  };
}

async function listMine(userId) {
  const items = await customWorkoutRepository.listForUser(userId);
  return items.map(toDto);
}

async function getMine(userId, id) {
  const workout = await customWorkoutRepository.findByIdForUser(id, userId);
  if (!workout) throw ApiError.notFound("Custom workout not found");
  return toDto(workout);
}

async function create(userId, data) {
  const workout = await customWorkoutRepository.create(userId, {
    ...data,
    scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null
  });
  return toDto(workout);
}

async function update(userId, id, data) {
  const existing = await customWorkoutRepository.findByIdForUser(id, userId);
  if (!existing) throw ApiError.notFound("Custom workout not found");
  const workout = await customWorkoutRepository.update(id, {
    ...data,
    ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null } : {})
  });
  return toDto(workout);
}

async function remove(userId, id) {
  const existing = await customWorkoutRepository.findByIdForUser(id, userId);
  if (!existing) throw ApiError.notFound("Custom workout not found");
  await customWorkoutRepository.delete(id);
}

async function completeAssigned(userId, id) {
  const workout = await customWorkoutRepository.findByIdForUser(id, userId);
  if (!workout) throw ApiError.notFound("Custom workout not found");
  if (!workout.assignedByUserId) throw ApiError.forbidden("Only coach-assigned workouts can be marked complete here");
  const now = new Date();
  const completionDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const alreadyCompleted = await prisma.customWorkoutCompletion.findUnique({
    where: { customWorkoutId_completionDate: { customWorkoutId: id, completionDate } }
  });
  if (!alreadyCompleted) {
    await prisma.customWorkoutCompletion.create({ data: { customWorkoutId: id, userId, completionDate } });
    await customWorkoutRepository.update(id, { completedAt: now });
  }
  return toDto(await customWorkoutRepository.findByIdForUser(id, userId));
}

module.exports = { listMine, getMine, create, update, remove, completeAssigned, toDto };
