ALTER TABLE "custom_workouts"
  ADD COLUMN "scheduled_at" TIMESTAMP(3),
  ADD COLUMN "schedule_type" TEXT NOT NULL DEFAULT 'ONCE',
  ADD COLUMN "schedule_days" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "custom_workouts_user_id_scheduled_at_idx"
  ON "custom_workouts"("user_id", "scheduled_at");
