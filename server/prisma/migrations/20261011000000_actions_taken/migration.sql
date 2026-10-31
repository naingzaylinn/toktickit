-- PostgreSQL DDL is transactional: a failed deployment must not leave partial
-- action tables or a partially installed workflow version column.
BEGIN;

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "actionDescription" TEXT NOT NULL,
    "actionResult" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "clientRequestId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionTakenRevision" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "actionDescription" TEXT NOT NULL,
    "actionResult" TEXT NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "assigneeId" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx" ON "ActionTaken"("ticketId", "createdAt", "id");
CREATE INDEX "ActionTaken_performedById_createdAt_id_idx" ON "ActionTaken"("performedById", "createdAt", "id");
CREATE INDEX "ActionTaken_assigneeId_idx" ON "ActionTaken"("assigneeId");
CREATE INDEX "ActionTaken_ticketId_status_idx" ON "ActionTaken"("ticketId", "status");
CREATE UNIQUE INDEX "ActionTaken_ticketId_performedById_clientRequestId_key" ON "ActionTaken"("ticketId", "performedById", "clientRequestId");
CREATE INDEX "ActionTakenRevision_editorId_idx" ON "ActionTakenRevision"("editorId");
CREATE INDEX "ActionTakenRevision_assigneeId_idx" ON "ActionTakenRevision"("assigneeId");
CREATE UNIQUE INDEX "ActionTakenRevision_actionId_version_key" ON "ActionTakenRevision"("actionId", "version");
CREATE INDEX "Ticket_currentStatus_ownerId_idx" ON "Ticket"("currentStatus", "ownerId");
CREATE INDEX "Ticket_updatedAt_ticketNumber_idx" ON "Ticket"("updatedAt" DESC, "ticketNumber" ASC);

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision" ADD CONSTRAINT "ActionTakenRevision_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Local seed identity metadata; no legacy User IDs or fields are rewritten.
CREATE TABLE "SeedUserIdentity" (
    "seedKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "SeedUserIdentity_pkey" PRIMARY KEY ("seedKey")
);
CREATE UNIQUE INDEX "SeedUserIdentity_userId_key" ON "SeedUserIdentity"("userId");
ALTER TABLE "SeedUserIdentity" ADD CONSTRAINT "SeedUserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
