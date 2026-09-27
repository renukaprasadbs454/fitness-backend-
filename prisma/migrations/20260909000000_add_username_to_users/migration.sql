-- AlterTable: add the column nullable first so existing rows can be backfilled
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill: derive an Instagram-style handle from the email local-part
-- (lowercased, stripped to [a-z0-9_.]), de-duplicating collisions by
-- appending 2, 3, 4, ... in signup order.
WITH base AS (
  SELECT
    id,
    created_at,
    NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.]', '', 'g'), '') AS base_username
  FROM "users"
),
numbered AS (
  SELECT
    id,
    COALESCE(base_username, 'user') AS base_username,
    ROW_NUMBER() OVER (PARTITION BY COALESCE(base_username, 'user') ORDER BY created_at, id) AS rn
  FROM base
)
UPDATE "users" u
SET "username" = CASE WHEN n.rn = 1 THEN n.base_username ELSE n.base_username || n.rn::text END
FROM numbered n
WHERE u.id = n.id;

-- AlterTable: now that every row has a value, enforce NOT NULL + uniqueness
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
