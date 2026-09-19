-- Extend the Lab 3 ticket workflow statuses while preserving the existing
-- "New" value used by migrated and requester-created tickets.
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'Open';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'InProgress';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WaitingForRequester';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'Resolved';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'Closed';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'Reopened';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'Cancelled';

-- Staff Ticket Queue needs to display and filter by the primary Ticket Owner.
-- Existing tickets remain unassigned.
ALTER TABLE "Ticket"
ADD COLUMN "ownerId" TEXT;

CREATE INDEX "Ticket_ownerId_idx"
ON "Ticket"("ownerId");

ALTER TABLE "Ticket"
ADD CONSTRAINT "Ticket_ownerId_fkey"
FOREIGN KEY ("ownerId")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;