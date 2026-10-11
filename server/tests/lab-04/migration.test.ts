import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";
import { migrationNames, withDatabaseFixture } from "../lab-03/databaseFixture.js";

const migration = "20261011000000_actions_taken";
const legacyTables = ["User", "Ticket", "Attachment", "PublicComment", "InternalNote", "TicketEvent", "Category", "RelatedSystem", "DevelopmentRequester", "TicketSequence", "Session", "LoginAttempt"];
async function baseline(prisma: PrismaClient) {
  // JSONB retains every column while keeping a stable result type across ALTER
  // TABLE; pooled prepared SELECT * plans otherwise fail after adding a column.
  return Promise.all(legacyTables.map(table => prisma.$queryRawUnsafe<Array<{ snapshot: Record<string, unknown> }>>(
    `SELECT to_jsonb(t) AS snapshot FROM "${table}" t ORDER BY ${table === "TicketSequence" ? '"year"' : table === "LoginAttempt" ? '"key"' : '"id"'}`,
  ).then(rows => rows.map(row => row.snapshot))));
}

describe("Issue 57 populated migration and deployment recovery", () => {
  it("T-38/T-39: preserves all legacy rows and safely retries an actual failed Prisma deployment", async () => {
    await withDatabaseFixture(async prisma => {
      const directory = await mkdtemp(join(tmpdir(), "toktickit-57-"));
      try {
        const migrations = join(directory, "migrations");
        await mkdir(migrations);
        await cp("prisma/schema.prisma", join(directory, "schema.prisma"));
        await cp("prisma/migrations/migration_lock.toml", join(migrations, "migration_lock.toml"));
        for (const name of (await migrationNames()).filter(n => n !== migration)) await cp(join("prisma/migrations", name), join(migrations, name), { recursive: true });
        // The fixture client's URL names its own generated schema, never the
        // developer schema. Read it via PostgreSQL, then explicitly target it.
        const [{ schema }] = await prisma.$queryRaw<Array<{ schema: string }>>`SELECT current_schema() AS schema`;
        expect(schema).toMatch(/^auth_fixture_[a-f0-9]{32}$/);
        const url = new URL(process.env.DATABASE_URL!);
        url.searchParams.set("schema", schema);
        const cli = (...args: string[]) => spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...args,
          ...(args[1] === "diff" ? [] : ["--schema", join(directory, "schema.prisma")])], {
          env: { ...process.env, DATABASE_URL: url.toString() }, encoding: "utf8", timeout: 30000,
        });
        const passed = (result: ReturnType<typeof cli>) => {
          // Prisma deploy output contains no credentials; don't print URLs.
          expect(result.error).toBeUndefined();
          expect(result.status, result.stderr).toBe(0);
        };
        passed(cli("migrate", "deploy"));
        const historic = new Date("2025-01-02T03:04:05.678Z");
        const user = await prisma.user.create({ data: { name: "Legacy staff", email: "legacy@example.com", role: "IT_STAFF", passwordHash: "existing-hash", mustChangePassword: false, createdAt: historic, updatedAt: historic } });
        const requester = await prisma.user.create({ data: { name: "Legacy requester", email: "requester@example.com", passwordHash: "other-hash", createdAt: historic, updatedAt: historic } });
        await prisma.developmentRequester.create({ data: { id: requester.id, name: requester.name, email: requester.email, createdAt: historic, updatedAt: historic } });
        const category = await prisma.category.create({ data: { name: "Legacy category", isActive: false, createdAt: historic, updatedAt: historic } });
        const system = await prisma.relatedSystem.create({ data: { name: "Legacy system", isActive: false, createdAt: historic, updatedAt: historic } });
        const ticketId = randomUUID();
        await prisma.$executeRaw`INSERT INTO "Ticket" ("id", "ticketNumber", "requesterId", "ownerId", "categoryId", "relatedSystemId", "summary", "description", "clientRequestId", "currentStatus", "requestedPriority", "itPriority", "problemAppearsResolvedAt", "ticketDate", "createdAt", "updatedAt") VALUES (${ticketId}, 'TKT-2025-00041', ${requester.id}, ${user.id}, ${category.id}, ${system.id}, 'Legacy resolved ticket', 'Keep all history', 'legacy-key', 'Resolved', 'High', 'Urgent', ${historic}, ${historic}, ${historic}, ${historic})`;
        const attachment = await prisma.attachment.create({ data: { ticketId, originalFilename: "historic.pdf", mimeType: "application/pdf", sizeBytes: 41, storageKey: "historic.pdf", isRemoved: true, removedAt: historic, removedByRequesterId: requester.id, removalReason: "Replaced", createdAt: historic, updatedAt: historic } });
        await prisma.ticketEvent.create({ data: { ticketId, attachmentId: attachment.id, actorRequesterId: requester.id, eventType: "ATTACHMENT_REMOVED", details: { reason: "Replaced" }, createdAt: historic } });
        await prisma.publicComment.create({ data: { ticketId, authorId: requester.id, content: "Historical comment", createdAt: historic } });
        await prisma.internalNote.create({ data: { ticketId, authorId: user.id, content: "Historical private note", createdAt: historic } });
        await prisma.ticketSequence.create({ data: { year: 2025, lastValue: 41, updatedAt: historic } });
        await prisma.session.create({ data: { userId: user.id, token: "historical-session-digest", expiresAt: new Date("2027-01-01"), createdAt: historic } });
        await prisma.loginAttempt.create({ data: { key: "historic-attempt", failures: [historic] } });
        const before = await baseline(prisma);
        const sql = await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8");
        expect(sql.replace(/^\s*--.*$/gm, "")).not.toMatch(/(?:^|;)\s*(DROP|TRUNCATE|DELETE|UPDATE)\b|\bRENAME\b|ALTER\s+TYPE\s+"TicketStatus"/i);
        await mkdir(join(migrations, migration));
        const target = join(migrations, migration, "migration.sql");
        await writeFile(target, sql.replace("COMMIT;", 'SELECT * FROM "deliberately_missing_issue57_table";\nCOMMIT;'));
        const failed = cli("migrate", "deploy");
        expect(failed.error).toBeUndefined();
        expect(failed.signal).toBeNull();
        expect(failed.status).toBeTypeOf("number");
        expect(failed.status).not.toBe(0);
        // Prisma 5.22 can report the aborted explicit transaction instead of
        // P3018 when recording the injected failure on the same connection.
        expect(failed.stderr).toMatch(/P3018|current transaction is aborted/);
        type Ledger = { id: string; migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; logs: string | null };
        const failedRows = await prisma.$queryRaw<Ledger[]>`SELECT id, migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations" WHERE migration_name = ${migration}`;
        expect(failedRows).toHaveLength(1);
        expect(failedRows[0]).toMatchObject({ migration_name: migration, finished_at: null, rolled_back_at: null });
        expect(await baseline(prisma)).toEqual(before);
        const installed = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('ActionTaken', 'ActionTakenRevision')`;
        expect(installed[0].count).toBe(0n);
        // Prisma refuses an unresolved failed migration, preserving baseline.
        const retry = cli("migrate", "deploy");
        expect(retry.error).toBeUndefined();
        expect(retry.signal).toBeNull();
        expect(retry.status).toBeTypeOf("number");
        expect(retry.status).not.toBe(0);
        expect(retry.stderr).toContain("P3009");
        expect(retry.stderr).toContain(migration);
        expect(await prisma.$queryRaw<Ledger[]>`SELECT id, migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations" WHERE migration_name = ${migration}`).toEqual(failedRows);
        expect(await baseline(prisma)).toEqual(before);
        await writeFile(target, sql);
        passed(cli("migrate", "resolve", "--rolled-back", migration));
        passed(cli("migrate", "deploy"));
        const after = await baseline(prisma);
        for (const [i, rows] of after.entries()) {
          if (legacyTables[i] === "Ticket") {
            expect(rows.every(row => row.workflowVersion === 0)).toBe(true);
            expect(rows.map(({ workflowVersion, ...legacy }) => legacy)).toEqual(before[i]);
          } else expect(rows).toEqual(before[i]);
        }
        expect(await prisma.actionTaken.count()).toBe(0);
        expect(await prisma.actionTakenRevision.count()).toBe(0);
        const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId }, include: { requester: true, owner: true, attachments: true, actionsTaken: true } });
        expect(ticket).toMatchObject({ currentStatus: "Resolved", requester: { id: requester.id }, owner: { id: user.id }, actionsTaken: [] });
        expect(ticket.attachments[0].id).toBe(attachment.id);
        const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema()`;
        for (const name of ["ActionTaken_ticketId_performedById_clientRequestId_key", "ActionTaken_ticketId_createdAt_id_idx", "ActionTaken_performedById_createdAt_id_idx", "ActionTaken_assigneeId_idx", "ActionTaken_ticketId_status_idx", "ActionTakenRevision_actionId_version_key", "ActionTakenRevision_editorId_idx", "ActionTakenRevision_assigneeId_idx", "Ticket_currentStatus_ownerId_idx", "Ticket_updatedAt_ticketNumber_idx"]) expect(indexes.some(i => i.indexname === name)).toBe(true);
        expect(indexes.find(i => i.indexname === "Ticket_updatedAt_ticketNumber_idx")?.indexdef).toContain('("updatedAt" DESC, "ticketNumber")');
        // One populated row is too small to demonstrate planner preference or
        // speed. Force the index candidate locally to prove mixed-order support.
        const explain = await prisma.$transaction(async tx => {
          await tx.$executeRawUnsafe("SET LOCAL enable_seqscan = off");
          return tx.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>('EXPLAIN SELECT "id", "updatedAt", "ticketNumber" FROM "Ticket" ORDER BY "updatedAt" DESC, "ticketNumber" ASC LIMIT 5');
        });
        const plan = explain.map(row => row["QUERY PLAN"]).join("\n");
        expect(plan).toContain("Ticket_updatedAt_ticketNumber_idx");
        expect(plan).not.toMatch(/\bSort\b/);
        console.log("Isolated forced-candidate recent-ticket EXPLAIN (not a performance benchmark):\n" + plan);
        const fks = await prisma.$queryRaw<Array<{ confdeltype: string }>>`SELECT c.confdeltype FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = current_schema() AND t.relname IN ('ActionTaken', 'ActionTakenRevision') AND c.contype = 'f'`;
        expect(fks).toHaveLength(6);
        expect(fks.every(fk => fk.confdeltype === "r")).toBe(true);
        passed(cli("migrate", "diff", "--from-schema-datasource", join(directory, "schema.prisma"), "--to-schema-datamodel", join(directory, "schema.prisma"), "--exit-code"));
        const action = await prisma.actionTaken.create({ data: { ticketId, performedById: user.id, assigneeId: user.id, actionDescription: "Recovery evidence", actionResult: "Retained", clientRequestId: randomUUID(), revisions: { create: { editorId: user.id, assigneeId: user.id, version: 1, status: "PENDING", actionDescription: "Recovery evidence", actionResult: "Retained", followUpRequired: false } } }, include: { revisions: true } });
        passed(cli("migrate", "deploy"));
        expect(await prisma.actionTaken.findUnique({ where: { id: action.id }, include: { revisions: true } })).toEqual(action);
        // Simulate a default-only deployment defect, then repair it with a new
        // forward migration. Existing action and audit rows must survive intact.
        await prisma.$executeRawUnsafe('ALTER TABLE "ActionTaken" ALTER COLUMN "followUpRequired" SET DEFAULT true');
        const forward = join(migrations, "20261011000001_fixture_forward_fix");
        await mkdir(forward);
        await writeFile(join(forward, "migration.sql"), 'BEGIN;\nALTER TABLE "ActionTaken" ALTER COLUMN "followUpRequired" SET DEFAULT false;\nCOMMIT;\n');
        passed(cli("migrate", "deploy"));
        expect(await prisma.actionTaken.findUnique({ where: { id: action.id }, include: { revisions: true } })).toEqual(action);
        passed(cli("migrate", "diff", "--from-schema-datasource", join(directory, "schema.prisma"), "--to-schema-datamodel", join(directory, "schema.prisma"), "--exit-code"));
      } finally {
        // Only remove the exact temporary copy created by this invocation.
        if (dirname(resolve(directory)) !== resolve(tmpdir()) || !directory.split(/[\\/]/).at(-1)?.startsWith("toktickit-57-")) throw new Error("Unsafe temporary path");
        await rm(directory, { recursive: true, force: true });
      }
    });
  }, 90000);
});
