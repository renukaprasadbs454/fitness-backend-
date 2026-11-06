ALTER TABLE "exercises"
  ADD COLUMN "calories_per_rep" DOUBLE PRECISION;

ALTER TABLE "workout_completions"
  ADD COLUMN "calories_burned" INTEGER;
