import { afterEach, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { getActions, getComments, getEligibleOwners, getManagedUsers, getStaffTicket, getStaffTickets, getTicketDetail, getTicketCategories, getRelatedSystems, getAttachmentContent, type ApiReadContext } from "../../src/api.js";
import RequesterDiscussion from "../../src/components/RequesterDiscussion.js";
import StaffTicketQueueScreen from "../../src/components/StaffTicketQueueScreen.js";
import StaffTicketDetailScreen from "../../src/components/StaffTicketDetailScreen.js";
import TicketDetailScreen from "../../src/components/TicketDetailScreen.js";
import ActionsTaken from "../../src/components/ActionsTaken.js";
import UserManagementScreen from "../../src/components/UserManagementScreen.js";
import CreateTicketScreen from "../../src/components/CreateTicketScreen.js";
import { dashboardUser } from "./dashboardFixture.js";
const reads: Array<[string,(context:ApiReadContext)=>Promise<unknown>]>=[
 ['detail',c=>getTicketDetail('ticket',c)],['comments',c=>getComments('ticket',c)],['staff detail',c=>getStaffTicket('ticket',c)],
 ['owners',c=>getEligibleOwners(c)],['actions',c=>getActions('ticket',true,{},c)],['queue',c=>getStaffTickets({},c)],['users',c=>getManagedUsers('','',c)],['categories',c=>getTicketCategories(c)],['systems',c=>getRelatedSystems(c)],['attachment content',c=>getAttachmentContent('ticket','attachment',false,c)],
];
afterEach(()=>vi.unstubAllGlobals());
const screens = [
 ['queue', () => <StaffTicketQueueScreen currentUser={dashboardUser} onOpenTicket={vi.fn()}/>],
 ['staff detail', () => <StaffTicketDetailScreen ticketId="ticket" currentUser={dashboardUser} onBack={vi.fn()}/>],
 ['requester detail', () => <TicketDetailScreen ticketId="ticket" currentRequester={dashboardUser} onBack={vi.fn()}/>],
 ['actions', () => <ActionsTaken ticketId="ticket" currentUser={dashboardUser}/>],
 ['users', () => <UserManagementScreen currentUser={{ ...dashboardUser, role: 'ADMINISTRATOR' }}/>],
 ['creation references', () => <CreateTicketScreen currentRequester={dashboardUser} onCreated={vi.fn()} onCancel={vi.fn()}/>],
] as const;
it.each(screens)('actual unmounted %s read owner suppresses late transport denial', async (_name, component) => {
 let release!:(r:Response)=>void, arrived!:()=>void; const old=new Promise<Response>(r=>release=r),started=new Promise<void>(r=>arrived=r);
 const events=vi.fn();window.addEventListener('session-access-changed',events);vi.stubGlobal('fetch',vi.fn(()=>{arrived();return old;}));
 try{const view=render(component());await act(async()=>{await started;});view.unmount();await act(async()=>release(new Response(JSON.stringify({error:{code:'AUTHENTICATION_REQUIRED'}}),{status:401})));expect(events).not.toHaveBeenCalled();}
 finally{window.removeEventListener('session-access-changed',events);}
});
it.each(reads)('O-01: obsolete %s read cannot emit global authentication loss after parsing',async(_name,read)=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);let current=true;const event=vi.fn();window.addEventListener('session-access-changed',event);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:401,json:async()=>{await gate;return {error:{code:'AUTHENTICATION_REQUIRED'}};}}));
 try{const pending=read({isCurrent:()=>current}).catch(()=>undefined);await Promise.resolve();current=false;release();await pending;expect(event).not.toHaveBeenCalled();}finally{window.removeEventListener('session-access-changed',event);}
});
it('O-03: failed comment retrieval is distinct from a genuine empty list and retries',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValueOnce(Error('network')).mockResolvedValueOnce(new Response(JSON.stringify({data:[]}))));
 render(<RequesterDiscussion ticketId="ticket"/>);await screen.findByText('Unable to load Public Comments.');
 expect(screen.queryByText('No Public Comments yet.')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Retry Public Comments'}));await screen.findByText('No Public Comments yet.');
});
it('unmounted discussion ignores a transport denial even when abort is ignored',async()=>{
 let release!:(r:Response)=>void;const response=new Promise<Response>(r=>release=r);const event=vi.fn();window.addEventListener('session-access-changed',event);vi.stubGlobal('fetch',vi.fn().mockReturnValue(response));
 try{const view=render(<RequesterDiscussion ticketId="ticket"/>);view.unmount();await act(async()=>release(new Response(JSON.stringify({error:{code:'PASSWORD_CHANGE_REQUIRED'}}),{status:403})));expect(event).not.toHaveBeenCalled();}finally{window.removeEventListener('session-access-changed',event);}
});
it.each(['AUTHENTICATION_REQUIRED','PASSWORD_CHANGE_REQUIRED','success','preview'])('unmounted binary %s cannot invalidate another identity or retain a binary URL',async kind=>{
 let release!:(r:Response)=>void,arrived!:()=>void;const held=new Promise<Response>(r=>release=r),started=new Promise<void>(r=>arrived=r);
 const requester={id:'requester',name:'Requester',email:'requester@test'};const date='2026-10-14T00:00:00.000Z';
 const detail={id:'ticket',ticketNumber:'TKT-1',ticketDate:date,currentStatus:'New',requestedPriority:'Medium',summary:'Owned binary Ticket',description:'Owned attachment regression',requester,category:{id:1,name:'Category',isActive:true},relatedSystem:{id:'system',name:'System',isActive:true},createdAt:date,updatedAt:date,removedAttachments:[],activeAttachments:[{id:'attachment',ticketId:'ticket',originalFilename:'private.png',mimeType:'image/png',sizeBytes:8,createdAt:date,isRemoved:false,removedAt:null,removalReason:null,removedByRequesterId:null}]};
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('/download')?(arrived(),held):Promise.resolve(new Response(JSON.stringify(url.includes('/actions?')?{data:[],meta:{page:1,pageSize:20,totalItems:0,totalPages:0}}:url.endsWith('/comments')?{data:[]}:{data:detail})))));
 const objectUrl=vi.fn(()=>'blob:private'),revoke=vi.fn();const OriginalURL=URL;vi.stubGlobal('URL',class extends OriginalURL{static createObjectURL=objectUrl;static revokeObjectURL=revoke;});
 const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});const events=vi.fn();window.addEventListener('session-access-changed',events);
 try{const view=render(<TicketDetailScreen ticketId="ticket" currentRequester={requester} onBack={vi.fn()}/>);await screen.findByText('private.png');fireEvent.click(screen.getByRole('button',{name:kind==='preview'?/^Preview$/:/^Download$/}));await started;
  if(kind==='preview'){await act(async()=>release(new Response('private binary')));await screen.findByRole('dialog');view.unmount();expect(revoke).toHaveBeenCalledWith('blob:private');return;}
  view.unmount();
  await act(async()=>release(kind==='success'?new Response('private binary'):new Response(JSON.stringify({error:{code:kind}}),{status:kind==='AUTHENTICATION_REQUIRED'?401:403})));
  expect(events).not.toHaveBeenCalled();expect(objectUrl).not.toHaveBeenCalled();expect(click).not.toHaveBeenCalled();
 }finally{window.removeEventListener('session-access-changed',events);click.mockRestore();}
});
