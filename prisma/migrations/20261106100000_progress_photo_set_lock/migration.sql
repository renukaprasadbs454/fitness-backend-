CREATE TABLE "progress_photo_set_locks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_photo_set_locks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "progress_photo_set_locks_user_id_created_at_idx"
ON "progress_photo_set_locks"("user_id", "created_at");

ALTER TABLE "progress_photo_set_locks"
ADD CONSTRAINT "progress_photo_set_locks_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the original start time of existing sets so the new 24-hour rule
-- applies immediately after this migration is deployed.
INSERT INTO "progress_photo_set_locks" ("id", "user_id", "created_at")
SELECT "session_id", "user_id", MIN("created_at")
FROM "media"
WHERE "type" = 'PROGRESS_IMAGE' AND "session_id" IS NOT NULL
GROUP BY "session_id", "user_id"
ON CONFLICT ("id") DO NOTHING;
