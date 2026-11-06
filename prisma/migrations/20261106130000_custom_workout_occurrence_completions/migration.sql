CREATE TABLE "custom_workout_completions" (
  "id" TEXT NOT NULL,
  "custom_workout_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "completion_date" DATE NOT NULL,
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_workout_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_workout_completions_custom_workout_id_completion_date_key"
  ON "custom_workout_completions"("custom_workout_id", "completion_date");
CREATE INDEX "custom_workout_completions_user_id_completed_at_idx"
  ON "custom_workout_completions"("user_id", "completed_at");

ALTER TABLE "custom_workout_completions"
  ADD CONSTRAINT "custom_workout_completions_custom_workout_id_fkey"
  FOREIGN KEY ("custom_workout_id") REFERENCES "custom_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_workout_completions"
  ADD CONSTRAINT "custom_workout_completions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
