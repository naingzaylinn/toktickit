-- CreateEnum
CREATE TYPE "RequestedPriority" AS ENUM ('Low', 'Medium', 'High', 'Urgent');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('New');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "ticketDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentStatus" "TicketStatus" NOT NULL DEFAULT 'New',
    "requestedPriority" "RequestedPriority" NOT NULL DEFAULT 'Medium',
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "relatedSystemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketSequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSequence_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_ticketNumber_key"
ON "Ticket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_requesterId_clientRequestId_key"
ON "Ticket"("requesterId", "clientRequestId");

-- CreateIndex
CREATE INDEX "Ticket_requesterId_idx"
ON "Ticket"("requesterId");

-- CreateIndex
CREATE INDEX "Ticket_categoryId_idx"
ON "Ticket"("categoryId");

-- CreateIndex
CREATE INDEX "Ticket_relatedSystemId_idx"
ON "Ticket"("relatedSystemId");

-- CreateIndex
CREATE INDEX "Ticket_ticketDate_idx"
ON "Ticket"("ticketDate");

-- AddForeignKey
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_requesterId_fkey"
FOREIGN KEY ("requesterId")
REFERENCES "DevelopmentRequester"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_categoryId_fkey"
FOREIGN KEY ("categoryId")
REFERENCES "Category"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_relatedSystemId_fkey"
FOREIGN KEY ("relatedSystemId")
REFERENCES "RelatedSystem"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
