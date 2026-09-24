-- Preserve the already-applied migration. Repair only its unchanged placeholder
-- credential, never a user's changed password. Initial123 is LOCAL LAB DATA ONLY.
UPDATE "User"
SET "passwordHash" = '$2b$12$yZtMGCcMFWBrvIUUeIrC9.5qEa2BL3hxM6C45LAZGRoJozfzOShAC'
WHERE "passwordHash" = '$2b$10$Y6d4K4Yj3nVQ8V8n6T0nKe9mD2R4k0QY4lqK3j7Qm8qV4V8kP7N5S'
  AND "mustChangePassword" = true;

-- Persist the sliding login-attempt window across server restarts.
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "failures" TIMESTAMP(3)[] NOT NULL,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);
