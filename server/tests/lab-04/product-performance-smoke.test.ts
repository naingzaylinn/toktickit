import { afterAll, beforeAll, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { requesterDashboardFixture, type RequesterFixture } from "./requesterDashboardFixture.js";
let f:RequesterFixture;let id:string;
beforeAll(async()=>{f=await requesterDashboardFixture();for(let i=0;i<60;i++){const t=await f.ownedTicket();if(!id)id=t.id;}await f.ownedTicket(f.other.id);
 await f.prisma.publicComment.createMany({data:Array.from({length:40},(_,i)=>({ticketId:id,authorId:f.users[0].id,content:'Smoke comment '+i}))});
 await f.prisma.internalNote.createMany({data:Array.from({length:40},(_,i)=>({ticketId:id,authorId:f.users[1].id,content:'Private smoke note '+i}))});
},20000);
afterAll(async()=>{vi.restoreAllMocks();await f?.close();});
it.each(['requester','staff'])('%s paginated list uses fixed operations and bounded projections',async role=>{
 const findOriginal=f.prisma.ticket.findMany.bind(f.prisma.ticket),countOriginal=f.prisma.ticket.count.bind(f.prisma.ticket);
 const rows=vi.spyOn(f.prisma.ticket,'findMany').mockImplementation(findOriginal),counts=vi.spyOn(f.prisma.ticket,'count').mockImplementation(countOriginal);
 try{const start=performance.now();const r=await request(app).get(role==='requester'?'/api/v1/tickets?pageSize=20&page=2':'/api/staff/tickets?pageSize=20&page=2').set('Cookie',role==='requester'?f.cookies[0]:f.cookies[1]);
  expect(r.status).toBe(200);expect(r.body.data).toHaveLength(20);expect(rows).toHaveBeenCalledTimes(1);expect(counts).toHaveBeenCalledTimes(1);
  const args=rows.mock.calls[0][0]!;expect(args.take).toBe(20);expect(args.skip).toBe(20);expect(args.select).toBeDefined();
  if(role==='requester'){expect(args.where).toMatchObject({requesterId:f.users[0].id});expect(args.select).toMatchObject({_count:{select:{attachments:{where:{isRemoved:false}}}}});}
  console.info(JSON.stringify({scope:role,fixtureTickets:61,logicalListOperations:2,pageRows:r.body.data.length,responseBytes:JSON.stringify(r.body).length,elapsedMs:Math.round(performance.now()-start)}));
 }finally{rows.mockRestore();counts.mockRestore();f.prisma.ticket.findMany=findOriginal;f.prisma.ticket.count=countOriginal;}
});
it('communication histories use bulk author projections and never expose private notes to requester',async()=>{
 const commentsOriginal=f.prisma.publicComment.findMany.bind(f.prisma.publicComment),notesOriginal=f.prisma.internalNote.findMany.bind(f.prisma.internalNote);
 const comments=vi.spyOn(f.prisma.publicComment,'findMany').mockImplementation(commentsOriginal),notes=vi.spyOn(f.prisma.internalNote,'findMany').mockImplementation(notesOriginal);
 const publicRead=await request(app).get('/api/v1/tickets/'+id+'/comments').set('Cookie',f.cookies[0]);expect(publicRead.status).toBe(200);expect(publicRead.body.data).toHaveLength(40);expect(comments).toHaveBeenCalledTimes(1);expect(notes).not.toHaveBeenCalled();expect(comments.mock.calls[0][0]?.select).toMatchObject({author:{select:{id:true,name:true,role:true}}});
 const privateRead=await request(app).get('/api/staff/tickets/'+id+'/notes').set('Cookie',f.cookies[1]);expect(privateRead.status).toBe(200);expect(privateRead.body.data).toHaveLength(40);expect(notes).toHaveBeenCalledTimes(1);expect(JSON.stringify(publicRead.body)).not.toContain('Private smoke note');
 console.info(JSON.stringify({communicationRows:80,logicalHistoryListOperations:2,publicBytes:JSON.stringify(publicRead.body).length,privateBytes:JSON.stringify(privateRead.body).length}));
});
