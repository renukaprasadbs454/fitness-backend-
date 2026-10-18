-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "duration_months" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "features" TEXT[],
    "badge" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_is_active_sort_order_idx" ON "packages"("is_active", "sort_order");

-- Default offers (editable by admins afterwards)
INSERT INTO "packages" ("id", "name", "tagline", "duration_months", "price", "original_price", "features", "badge", "sort_order", "updated_at") VALUES
  (gen_random_uuid()::text, 'Monthly', 'Try it out, cancel anytime', 1, 1499.00, 1999.00,
    ARRAY['Unlimited workout plans','BMI, calorie & progress tracking','Chat with coaches'], NULL, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Quarterly', 'Build the habit', 3, 3499.00, 5997.00,
    ARRAY['Everything in Monthly','2 coach sessions included','Custom workout plan'], 'MOST POPULAR', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'Yearly', 'Best price per month', 12, 9999.00, 23988.00,
    ARRAY['Everything in Quarterly','12 coach sessions included','Priority coach support'], 'BEST VALUE', 3, CURRENT_TIMESTAMP);
