-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('ATTACHMENT_REMOVED');

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "isRemoved" BOOLEAN NOT NULL DEFAULT false,
    "removedAt" TIMESTAMP(3),
    "removedByRequesterId" TEXT,
    "removalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "attachmentId" TEXT,
    "actorRequesterId" TEXT,
    "eventType" "TicketEventType" NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key"
ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_ticketId_idx"
ON "Attachment"("ticketId");

-- CreateIndex
CREATE INDEX "Attachment_ticketId_isRemoved_idx"
ON "Attachment"("ticketId", "isRemoved");

-- CreateIndex
CREATE INDEX "Attachment_removedByRequesterId_idx"
ON "Attachment"("removedByRequesterId");

-- CreateIndex
CREATE INDEX "TicketEvent_ticketId_idx"
ON "TicketEvent"("ticketId");

-- CreateIndex
CREATE INDEX "TicketEvent_attachmentId_idx"
ON "TicketEvent"("attachmentId");

-- CreateIndex
CREATE INDEX "TicketEvent_actorRequesterId_idx"
ON "TicketEvent"("actorRequesterId");

-- CreateIndex
CREATE INDEX "TicketEvent_eventType_idx"
ON "TicketEvent"("eventType");

-- CreateIndex
CREATE INDEX "TicketEvent_createdAt_idx"
ON "TicketEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_ticketId_fkey"
FOREIGN KEY ("ticketId")
REFERENCES "Ticket"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_removedByRequesterId_fkey"
FOREIGN KEY ("removedByRequesterId")
REFERENCES "DevelopmentRequester"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent"
ADD CONSTRAINT "TicketEvent_ticketId_fkey"
FOREIGN KEY ("ticketId")
REFERENCES "Ticket"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent"
ADD CONSTRAINT "TicketEvent_attachmentId_fkey"
FOREIGN KEY ("attachmentId")
REFERENCES "Attachment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent"
ADD CONSTRAINT "TicketEvent_actorRequesterId_fkey"
FOREIGN KEY ("actorRequesterId")
REFERENCES "DevelopmentRequester"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;