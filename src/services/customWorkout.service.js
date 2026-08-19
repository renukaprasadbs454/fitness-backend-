const customWorkoutRepository = require("../repositories/customWorkout.repository");
const ApiError = require("../utils/ApiError");

function toDto(workout) {
  return {
    id: workout.id,
    title: workout.title,
    description: workout.description,
    durationMinutes: workout.durationMinutes,
    difficulty: workout.difficulty,
    categoryKey: workout.categoryKey,
    createdAt: workout.createdAt,
    updatedAt: workout.updatedAt,
    exercises: workout.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroup: e.muscleGroup,
      equipment: e.equipment,
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
  const workout = await customWorkoutRepository.create(userId, data);
  return toDto(workout);
}

async function update(userId, id, data) {
  const existing = await customWorkoutRepository.findByIdForUser(id, userId);
  if (!existing) throw ApiError.notFound("Custom workout not found");
  const workout = await customWorkoutRepository.update(id, data);
  return toDto(workout);
}

async function remove(userId, id) {
  const existing = await customWorkoutRepository.findByIdForUser(id, userId);
  if (!existing) throw ApiError.notFound("Custom workout not found");
  await customWorkoutRepository.delete(id);
}

module.exports = { listMine, getMine, create, update, remove };
