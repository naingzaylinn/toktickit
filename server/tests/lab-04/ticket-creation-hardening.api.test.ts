import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../../src/app.js";
import { requesterDashboardFixture, type RequesterFixture } from "./requesterDashboardFixture.js";
let f: RequesterFixture;
let body: { categoryId: number; relatedSystemId: string; summary: string; description: string; clientRequestId: string };
beforeEach(async()=>{f=await requesterDashboardFixture();const t=await f.ownedTicket();body={categoryId:t.categoryId,relatedSystemId:t.relatedSystemId,summary:"Hardening Ticket",description:"Verified creation intent",clientRequestId:randomUUID()};});
afterEach(async()=>{vi.restoreAllMocks();await f?.close();});
const create=(data=body,cookie=f.cookies[0])=>request(app).post('/api/v1/tickets').set('Cookie',cookie).send(data);
async function compete(changed=false){
 const original=f.prisma.ticket.findUnique.bind(f.prisma.ticket);let arrivals=0,release!:()=>void;const gate=new Promise<void>(r=>{release=r;});
 const initialReads: unknown[]=[];
 const spy=vi.spyOn(f.prisma.ticket,'findUnique').mockImplementation((async(args:any)=>{const row=await original(args);if(args.where.requesterId_clientRequestId && ++arrivals<=2){initialReads.push(row);if(arrivals===2)release();await gate;}return row;}) as typeof f.prisma.ticket.findUnique);
 const timeout=setTimeout(release,3000);
 try{const responses=await Promise.all([create().then(r=>r),create(changed?{...body,summary:'Different intent'}:body).then(r=>r)]);expect(initialReads).toEqual([null,null]);return responses;}finally{clearTimeout(timeout);release();spy.mockRestore();f.prisma.ticket.findUnique=original;}
}
it('F-02: identical concurrent intents create once and replay outside the aborted transaction',async()=>{
 const rs=await compete();expect(rs.map(r=>r.status).sort()).toEqual([200,201]);expect(rs[0].body.data.id).toBe(rs[1].body.data.id);
 expect(await f.prisma.ticket.count({where:{clientRequestId:body.clientRequestId}})).toBe(1);expect(await f.prisma.ticketSequence.findUnique({where:{year:new Date().getUTCFullYear()}})).toMatchObject({lastValue:1});
 expect(await f.prisma.ticket.findUnique({where:{requesterId_clientRequestId:{requesterId:f.users[0].id,clientRequestId:body.clientRequestId}}})).toMatchObject({id:rs[0].body.data.id});
 const replay=await create({...body,summary:'  '+body.summary+'  '});expect(replay.status).toBe(200);expect(replay.headers['idempotent-replay']).toBe('true');expect(await f.prisma.ticketEvent.count()).toBe(0);
});
it('same key with different concurrent intent remains a conflict',async()=>{const rs=await compete(true);expect(rs.map(r=>r.status).sort()).toEqual([201,409]);expect(rs.find(r=>r.status===409)!.body.error.code).toBe('IDEMPOTENCY_CONFLICT');expect(await f.prisma.ticket.count({where:{clientRequestId:body.clientRequestId}})).toBe(1);});
it('request keys are scoped independently to each requester',async()=>{const rs=await Promise.all([create(),create(body,f.otherCookie)]);expect(rs.map(r=>r.status)).toEqual([201,201]);expect(rs[0].body.data.id).not.toBe(rs[1].body.data.id);expect(await f.prisma.ticketSequence.findUnique({where:{year:new Date().getUTCFullYear()}})).toMatchObject({lastValue:2});});
it.each(['ticketNumber','unrelated'])('unrelated %s uniqueness failure is not replayed',async field=>{
 vi.spyOn(f.prisma,'$transaction').mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('private unique error',{code:'P2002',clientVersion:'test',meta:{target:[field]}}));
 const r=await create();expect(r.status).toBe(500);expect(JSON.stringify(r.body)).not.toContain('private');expect(await f.prisma.ticket.count({where:{clientRequestId:body.clientRequestId}})).toBe(0);
});
it('late database failure rolls back Ticket and sequence',async()=>{
 await f.prisma.$executeRawUnsafe(`CREATE FUNCTION fail_ticket() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'private creation failure'; END; $$ LANGUAGE plpgsql`);
 await f.prisma.$executeRawUnsafe(`CREATE TRIGGER fail_ticket BEFORE INSERT ON "Ticket" FOR EACH ROW EXECUTE FUNCTION fail_ticket()`);
 expect((await create()).status).toBe(500);expect(await f.prisma.ticket.count({where:{clientRequestId:body.clientRequestId}})).toBe(0);expect(await f.prisma.ticketSequence.count()).toBe(0);
});
