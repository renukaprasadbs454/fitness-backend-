ALTER TABLE "custom_workouts"
  ADD COLUMN "accent_color" TEXT NOT NULL DEFAULT '#2563EB',
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "video_url" TEXT,
  ADD COLUMN "is_available" BOOLEAN NOT NULL DEFAULT TRUE;
