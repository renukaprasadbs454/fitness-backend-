ALTER TABLE "exercises"
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "video_url" TEXT;

ALTER TABLE "custom_workout_exercises"
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "video_url" TEXT;
