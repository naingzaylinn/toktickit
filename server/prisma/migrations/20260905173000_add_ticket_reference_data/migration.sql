-- AlterTable
ALTER TABLE "Category"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill updatedAt for existing Lab 1 Category rows
UPDATE "Category"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE "updatedAt" IS NULL;

-- Make updatedAt required after backfill
ALTER TABLE "Category"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "RelatedSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatedSystem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelatedSystem_name_key"
ON "RelatedSystem"("name");