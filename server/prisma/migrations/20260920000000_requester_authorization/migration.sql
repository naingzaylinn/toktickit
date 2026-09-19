-- Copy any legacy requester added since Issue #32, without replacing credentials.
-- Normalized-email collisions fail safely and require an explicit data decision.
INSERT INTO "User" ("id", "name", "email", "role", "isActive", "passwordHash", "mustChangePassword", "createdAt", "updatedAt")
SELECT dr."id", dr."name", LOWER(TRIM(dr."email")), 'REQUESTER'::"Role", dr."isActive",
 '$2b$12$yZtMGCcMFWBrvIUUeIrC9.5qEa2BL3hxM6C45LAZGRoJozfzOShAC', true, dr."createdAt", dr."updatedAt"
FROM "DevelopmentRequester" dr WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = dr."id");

-- Preserve IDs and all ticket/attachment/event data while moving ownership to User.
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_removedByRequesterId_fkey";
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_removedByRequesterId_fkey" FOREIGN KEY ("removedByRequesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketEvent" DROP CONSTRAINT "TicketEvent_actorRequesterId_fkey";
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_actorRequesterId_fkey" FOREIGN KEY ("actorRequesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Ticket" ADD COLUMN "itPriority" "RequestedPriority" NOT NULL DEFAULT 'Medium', ADD COLUMN "problemAppearsResolvedAt" TIMESTAMP(3);
UPDATE "Ticket" SET "itPriority" = "requestedPriority";
CREATE TABLE "PublicComment" (
 "id" TEXT NOT NULL, "ticketId" TEXT NOT NULL, "authorId" TEXT NOT NULL,
 "content" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt");
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
