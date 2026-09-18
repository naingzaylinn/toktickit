-- CreateEnum
CREATE TYPE "Role" AS ENUM (
    'REQUESTER',
    'IT_STAFF',
    'ADMINISTRATOR'
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'REQUESTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT NOT NULL,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey"
    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey"
    PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "User_email_key"
ON "User"("email");

CREATE UNIQUE INDEX "Session_token_key"
ON "Session"("token");

CREATE INDEX "Session_token_idx"
ON "Session"("token");

CREATE INDEX "Session_userId_idx"
ON "Session"("userId");

-- Foreign key
ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Seed existing DevelopmentRequester records into User
INSERT INTO "User" (
    "id",
    "name",
    "email",
    "role",
    "isActive",
    "passwordHash",
    "mustChangePassword",
    "createdAt",
    "updatedAt"
)
SELECT
    dr."id",
    dr."name",
    LOWER(TRIM(dr."email")),
    'REQUESTER'::"Role",
    dr."isActive",
    '$2b$10$Y6d4K4Yj3nVQ8V8n6T0nKe9mD2R4k0QY4lqK3j7Qm8qV4V8kP7N5S',
    true,
    dr."createdAt",
    CURRENT_TIMESTAMP
FROM "DevelopmentRequester" dr
ON CONFLICT ("id") DO NOTHING;