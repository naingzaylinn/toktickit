import { afterEach, beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { app } from "../../src/app.js";
import { requesterDashboardFixture, type RequesterFixture } from "./requesterDashboardFixture.js";
import { getAttachmentStorageDirectory } from "../../src/services/attachmentStorage.js";
let f: RequesterFixture;
let id: string;
const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
const base = () => `/api/v1/tickets/${id}/attachments`;
const upload = (ticketId = id, cookie = f.cookies[0], buffer = png) => request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set("Cookie", cookie).attach("files", buffer, { filename: "evidence.png", contentType: "image/png" });
const remove = (attachmentId: string, reason = "First removal", cookie = f.cookies[0]) => request(app).delete(base() + "/" + attachmentId).set("Cookie", cookie).send({ reason });
beforeEach(async () => { f = await requesterDashboardFixture(); id = (await f.ownedTicket()).id; }, 20000);
afterEach(async () => { vi.restoreAllMocks(); await f?.close(); }, 20000);
async function active() { return f.prisma.attachment.findMany({ where: { ticketId: id, isRemoved: false } }); }
async function populate(n: number) { for (let i = 0; i < n; i++) expect((await upload()).status).toBe(201); }
// The independent holder forces both requests into the same real database
// interleaving. Observe blocked connections; elapsed delay is never proof.
async function race<T>(requests: () => Promise<T>[]) {
 let acquired!: (pid: number) => void, release!: () => void;
 const ready = new Promise<number>(r => { acquired = r; }); const gate = new Promise<void>(r => { release = r; });
 const holder = f.prisma.$transaction(async tx => {
  await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${id} FOR UPDATE`;
  const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
  acquired(connection.pid); await gate;
 }, { timeout: 15000 });
 const pid = await ready; const pending = requests();
 const safety = setTimeout(release, 6000);
 try {
  const deadline = Date.now() + 5000; let count = 0;
  while (Date.now() < deadline) {
   const [row] = await f.prisma.$queryRaw<{ count: bigint }[]>`WITH RECURSIVE waiting AS (SELECT pid FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid)) UNION SELECT a.pid FROM pg_stat_activity a JOIN waiting w ON w.pid = ANY(pg_blocking_pids(a.pid))) SELECT count(*) FROM waiting`;
   count = Number(row.count); if (count >= pending.length) break; await new Promise<void>(r => setImmediate(r));
  }
  expect(count).toBeGreaterThanOrEqual(pending.length);
 } finally { release(); clearTimeout(safety); await holder; await Promise.allSettled(pending); }
 return Promise.all(pending);
}
it("F-03: two uploads competing for one slot cannot persist a sixth file", async () => {
 await populate(4); const responses = await race(() => [upload().then(r => r), upload().then(r => r)]);
 expect(responses.map(r => r.status).sort()).toEqual([201,400]); expect(await active()).toHaveLength(5);
});
it("F-04: concurrent removals retain exactly one tombstone and audit event", async () => {
 await populate(1); const a = (await active())[0]; const responses = await race(() => [remove(a.id, "Reason A").then(r => r), remove(a.id, "Reason B").then(r => r)]);
 expect(responses.map(r => r.status).sort()).toEqual([200,409]);
 const winner = responses.find(r => r.status === 200)!;
 const tombstone = await f.prisma.attachment.findUniqueOrThrow({ where: { id: a.id } });
 expect(tombstone.removalReason).toBe(winner.body.data.removalReason); expect(tombstone.removedByRequesterId).toBe(f.users[0].id);
 const events = await f.prisma.ticketEvent.findMany({ where: { attachmentId: a.id } }); expect(events).toHaveLength(1); expect(events[0].details).toMatchObject({ reason: tombstone.removalReason });
 expect((await remove(a.id, "Overwrite attempt")).status).toBe(409);
 expect(await f.prisma.attachment.findUnique({ where: { id: a.id } })).toEqual(tombstone);
 expect((await request(app).get(base()+`/${a.id}/download`).set("Cookie",f.cookies[0])).status).toBe(404);
});
it("multiple competing uploads use available capacity", async () => {
 const responses = await race(() => [upload().then(r => r),upload().then(r => r)]); expect(responses.map(r=>r.status)).toEqual([201,201]); expect(await active()).toHaveLength(2);
});
it("uploads on different Tickets do not wait for another Ticket's lock", async () => {
 const other = await f.ownedTicket(); let acquired!: () => void, release!: () => void;
 const ready = new Promise<void>(r => { acquired = r; }); const gate = new Promise<void>(r => { release = r; });
 const holder = f.prisma.$transaction(async tx => { await tx.$queryRaw`SELECT "id" FROM "Ticket" WHERE "id" = ${id} FOR UPDATE`; acquired(); await gate; }, { timeout: 10000 });
 await ready;
 try { expect((await upload(other.id)).status).toBe(201); expect(await active()).toHaveLength(0); }
 finally { release(); await holder; }
});
it("upload/removal race never exceeds five and valid removal frees capacity", async () => {
 await populate(5); const a=(await active())[0]; const responses=await race(()=>[upload().then(r=>r),remove(a.id).then(r=>r)]);
 expect(responses[1].status).toBe(200); expect([201,400]).toContain(responses[0].status); expect((await active()).length).toBeLessThanOrEqual(5);
 if(responses[0].status===400) expect((await upload()).status).toBe(201); expect(await active()).toHaveLength(5);
});
it("foreign and staff attachment writes remain forbidden", async()=>{
 expect((await upload(id,f.otherCookie)).status).toBe(404); expect((await upload(id,f.cookies[1])).status).toBe(403);
 await populate(1);const a=(await active())[0];expect((await remove(a.id,"Foreign",f.otherCookie)).status).toBe(404);expect((await remove(a.id,"Staff",f.cookies[1])).status).toBe(403);expect(await active()).toHaveLength(1);
});
it("failed metadata insertion compensates the real binary",async()=>{
 const directory=getAttachmentStorageDirectory();const before=await readdir(directory).catch(()=>[]);
 await f.prisma.$executeRawUnsafe(`CREATE FUNCTION fail_attachment() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'private metadata failure'; END; $$ LANGUAGE plpgsql`);
 await f.prisma.$executeRawUnsafe(`CREATE TRIGGER fail_attachment BEFORE INSERT ON "Attachment" FOR EACH ROW EXECUTE FUNCTION fail_attachment()`);
 const response=await upload();expect(response.status).toBe(400);expect(await active()).toHaveLength(0);expect(await readdir(directory)).toEqual(before);expect(JSON.stringify(response.body)).not.toContain("private metadata failure");
});
it("failed audit insertion rolls back tombstone and preserves binary",async()=>{
 await populate(1);const a=(await active())[0];
 await f.prisma.$executeRawUnsafe(`CREATE FUNCTION fail_event() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'private audit failure'; END; $$ LANGUAGE plpgsql`);
 await f.prisma.$executeRawUnsafe(`CREATE TRIGGER fail_event BEFORE INSERT ON "TicketEvent" FOR EACH ROW EXECUTE FUNCTION fail_event()`);
 expect((await remove(a.id)).status).toBe(500);expect(await f.prisma.attachment.findUnique({where:{id:a.id}})).toEqual(a);expect(await f.prisma.ticketEvent.count()).toBe(0);
 expect(await readFile(path.join(getAttachmentStorageDirectory(),a.storageKey))).toEqual(png);
});
