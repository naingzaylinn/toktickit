import { afterEach, beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { app } from "../../src/app.js";
import { requesterDashboardFixture, type RequesterFixture } from "./requesterDashboardFixture.js";
import { getAttachmentStorageDirectory } from "../../src/services/attachmentStorage.js";
let f:RequesterFixture;let id:string;
beforeEach(async()=>{f=await requesterDashboardFixture();id=(await f.ownedTicket()).id;});
afterEach(async()=>{vi.restoreAllMocks();await f?.close();});
const base=()=>'/api/v1/tickets/'+id;
const png=(size:number)=>{const b=Buffer.alloc(size);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);return b;};
it('F-06: paginated owned lists count only active files without private metadata',async()=>{
 await f.prisma.attachment.createMany({data:[false,false,true].map(isRemoved=>({ticketId:id,originalFilename:'count.png',mimeType:'image/png',sizeBytes:8,storageKey:randomUUID(),isRemoved}))});
 for(let i=0;i<11;i++)await f.ownedTicket();const foreign=await f.ownedTicket(f.other.id);await f.prisma.attachment.create({data:{ticketId:foreign.id,originalFilename:'private.png',mimeType:'image/png',sizeBytes:8,storageKey:randomUUID()}});
 const list=(await request(app).get('/api/v1/tickets?pageSize=10').set('Cookie',f.cookies[0])).body;
 const second=(await request(app).get('/api/v1/tickets?page=2&pageSize=10').set('Cookie',f.cookies[0])).body;
 const rows=[...list.data,...second.data];expect(rows).toHaveLength(12);expect(rows.find((r:any)=>r.id===id).activeAttachmentCount).toBe(2);expect(rows.filter((r:any)=>r.id!==id).every((r:any)=>r.activeAttachmentCount===0)).toBe(true);expect(JSON.stringify(rows)).not.toMatch(/storageKey|private.png/);
});
it.each([5*1024*1024,5*1024*1024+1,6*1024*1024+1])('F-08: size boundary %s has a safe response',async size=>{
 const before=await readdir(getAttachmentStorageDirectory()).catch(()=>[]);const r=await request(app).post(base()+'/attachments').set('Cookie',f.cookies[0]).attach('files',png(size),{filename:'size.png',contentType:'image/png'});
 expect(r.status).toBe(size===5*1024*1024?201:size>6*1024*1024?413:400);
 if(size!==5*1024*1024){expect(await f.prisma.attachment.count()).toBe(0);expect(await readdir(getAttachmentStorageDirectory()).catch(()=>[])).toEqual(before);expect(JSON.stringify(r.body)).not.toMatch(/stack|node_modules|EPERM/);}
});
it.each(['excess','field','malformed','content'])('multipart %s is rejected without persistence',async kind=>{
 let req=request(app).post(base()+'/attachments').set('Cookie',f.cookies[0]);
 if(kind==='excess')for(let i=0;i<11;i++)req=req.attach('files',png(8),{filename:'a.png',contentType:'image/png'});
 if(kind==='field')req=req.attach('unexpected',png(8),{filename:'a.png',contentType:'image/png'});
 if(kind==='malformed')req=req.set('Content-Type','multipart/form-data; boundary=missing').send('broken');
 if(kind==='content')req=req.send({files:'unsupported'});
 const r=await req;expect(r.status).toBe(kind==='content'?415:400);expect(r.body.error.code).toBe(kind==='content'?'UNSUPPORTED_CONTENT_TYPE':'INVALID_MULTIPART');expect(await f.prisma.attachment.count()).toBe(0);
});
it.each(['comment','note','summary','description','name','email','reason'])('F-09: NUL in %s is a safe validation rejection with no write',async field=>{
 const before=await f.prisma.ticket.findUnique({where:{id}});const users=await f.prisma.user.count();let r;
 if(field==='comment')r=await request(app).post(base()+'/comments').set('Cookie',f.cookies[0]).send({content:'Valid\u0000text'});
 if(field==='note')r=await request(app).post('/api/staff/tickets/'+id+'/notes').set('Cookie',f.cookies[1]).send({content:'Valid\u0000text'});
 if(field==='summary'||field==='description')r=await request(app).post('/api/v1/tickets').set('Cookie',f.cookies[0]).send({categoryId:before!.categoryId,relatedSystemId:before!.relatedSystemId,clientRequestId:randomUUID(),summary:'Valid summary',description:'Valid description',[field]:'Valid\u0000persisted text'});
 if(field==='name'||field==='email')r=await request(app).post('/api/admin/users').set('Cookie',f.cookies[2]).send({name:'Valid name',email:'valid@test.local',role:'REQUESTER',isActive:true,initialPassword:'Initial123',[field]:field==='email'?'nul\u0000@test.local':'Valid\u0000name'});
 if(field==='reason'){const a=await f.prisma.attachment.create({data:{ticketId:id,originalFilename:'a.png',mimeType:'image/png',sizeBytes:8,storageKey:randomUUID()}});r=await request(app).delete(base()+'/attachments/'+a.id).set('Cookie',f.cookies[0]).send({reason:'Valid\u0000reason'});expect((await f.prisma.attachment.findUniqueOrThrow({where:{id:a.id}})).isRemoved).toBe(false);}
 expect(r!.status).toBe(400);expect(await f.prisma.ticket.findUnique({where:{id}})).toEqual(before);expect(await f.prisma.user.count()).toBe(users);expect(await f.prisma.publicComment.count()).toBe(0);expect(await f.prisma.internalNote.count()).toBe(0);
});
it('legitimate multilingual persisted text is preserved',async()=>{const content='ภาษาไทย 日本語 café 👩‍💻';const r=await request(app).post(base()+'/comments').set('Cookie',f.cookies[0]).send({content});expect(r.status).toBe(201);expect(r.body.data.content).toBe(content);});
it.each(['q=x&q=y','categoryId[bad]=1','relatedSystemId[]=x','relatedSystemId=x&relatedSystemId=y','%72elatedSystemId=x&relatedSystemId=y','page=1&page=2'])('O-04: scalar filter contract rejects %s',async query=>{
 const r=await request(app).get('/api/v1/tickets?'+query).set('Cookie',f.cookies[0]);expect(r.status).toBe(400);expect(r.body.error.code).toBe('INVALID_QUERY_PARAMS');
});
it('unknown TEXT system filter still returns zero scoped matches',async()=>{const r=await request(app).get('/api/v1/tickets?relatedSystemId=unknown-text-id').set('Cookie',f.cookies[0]);expect(r.status).toBe(200);expect(r.body.data).toEqual([]);expect(r.body.pagination.totalItems).toBe(0);});
