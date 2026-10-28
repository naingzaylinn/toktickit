import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CreateTicketScreen from "../../src/components/CreateTicketScreen.js";
import App from "../../src/App.js";
import { createTicket, uploadTicketAttachments, type AuthUser } from "../../src/api.js";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
const deferred=()=>{let resolve!:(r:Response)=>void;const promise=new Promise<Response>(r=>{resolve=r;});return {resolve,promise};};
const user={id:'requester',name:'Requester',email:'requester@test'};
const ticket={id:'ticket',ticketNumber:'TKT-1',currentStatus:'New'};
async function setup(post:(input:any)=>Promise<Response>,upload?:()=>Promise<Response>,isSessionCurrent?:()=>boolean){
 const inputs:any[]=[];let uploads=0;
 vi.stubGlobal('fetch',vi.fn((url:string,options:any)=>{
  if(url.endsWith('/categories'))return Promise.resolve(json({data:[{id:1,name:'Category'}]}));
  if(url.endsWith('/related-systems'))return Promise.resolve(json({data:[{id:'system',name:'System'}]}));
  if(url.endsWith('/attachments')){uploads++;return upload!();}
  const input=JSON.parse(options.body);inputs.push(input);return post(input);
 }));
 const created=vi.fn();const view=render(<CreateTicketScreen currentRequester={user} isSessionCurrent={isSessionCurrent} onCreated={created} onCancel={vi.fn()}/>);
 await screen.findByRole('option',{name:'System'});
 fireEvent.change(screen.getByLabelText(/Category/),{target:{value:'1'}});fireEvent.change(screen.getByLabelText(/Related System/),{target:{value:'system'}});
 fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'Original summary'}});fireEvent.change(screen.getByLabelText(/^Description/),{target:{value:'Original description'}});
 const submit=()=>fireEvent.submit(view.container.querySelector('form')!);
 return {created,inputs,submit,view,uploads:()=>uploads};
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('AX-05: local validation focuses first invalid field without creating a retry intent',async()=>{
 const f=await setup(()=>Promise.resolve(json({data:ticket})));fireEvent.change(screen.getByLabelText(/Category/),{target:{value:''}});f.submit();
 const category=screen.getByLabelText(/Category/);await waitFor(()=>expect(category).toHaveFocus());expect(category).toHaveAttribute('aria-invalid','true');expect(f.inputs).toHaveLength(0);
});
async function fillCreation(container: HTMLElement) {
 await screen.findByRole('option',{name:'System'});
 for(const [label,value] of [[/Category/,'1'],[/Related System/,'system'],[/Ticket Summary/,'Original summary'],[/^Description/,'Original description']] as const) fireEvent.change(screen.getByLabelText(label),{target:{value}});
 fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[new File(['private'],'private-A.png',{type:'image/png'})]}});
}
const denied=(code:string)=>json({error:{code}},code==='AUTHENTICATION_REQUIRED'?401:403);
it.each(['success','partial','failure','uncertain','replacement'])('R-02 App: failed logout during %s upload reviews the confirmed Ticket without replaying the batch',async outcome=>{
 window.history.replaceState({},'', '/tickets/new');const held=deferred();const a:AuthUser={...user,id:'A',role:'REQUESTER',isActive:true,mustChangePassword:false};const creates=vi.fn(),uploads=vi.fn();let logouts=0,actor=a;
 vi.stubGlobal('fetch',vi.fn((url:string,options:any)=>{
  if(url==='/api/auth/me')return Promise.resolve(json({data:actor}));
  if(url==='/api/auth/logout')return ++logouts===1?Promise.reject(Error('Logout failed')):Promise.resolve(json({data:{}}));
  if(url==='/api/auth/login'){actor={...a,id:'B',name:'Requester B'};return Promise.resolve(json({data:{user:actor}}));}
  if(url.endsWith('/categories'))return Promise.resolve(json({data:[{id:1,name:'Category'}]}));
  if(url.endsWith('/related-systems'))return Promise.resolve(json({data:[{id:'system',name:'System'}]}));
  if(url.endsWith('/attachments')){uploads(options.body.getAll('files').map((file:File)=>file.name));return held.promise;}
  if(options?.method==='POST'){creates();return Promise.resolve(json({data:ticket},201));}
  if(url==='/api/tickets/ticket')return Promise.resolve(json({data:{...ticket,ticketDate:'2026-10-14T00:00:00Z',summary:'Original summary',description:'Original description',requester:a,category:{id:1,name:'Category'},relatedSystem:{id:'system',name:'System'},activeAttachments:[],removedAttachments:[]}}));
  return Promise.resolve(json({data:[],meta:{page:1,pageSize:20,totalItems:0,totalPages:0},pagination:{page:1,pageSize:10,totalItems:0,totalPages:0,hasNextPage:false,hasPreviousPage:false}}));
 }));
 const view=render(<App/>);await fillCreation(view.container);if(outcome==='partial')fireEvent.change(view.container.querySelector('input[type=file]')!,{target:{files:[new File(['rejected'],'rejected.png',{type:'image/png'})]}});const originalForm=view.container.querySelector('form')!;fireEvent.submit(originalForm);await waitFor(()=>expect(uploads).toHaveBeenCalledTimes(1));
 fireEvent.click(screen.getByRole('button',{name:'Logout'}));await screen.findByText('Unable to log out. Please try again.');
 if(outcome!=='uncertain'&&outcome!=='replacement')await act(async()=>held.resolve(outcome==='failure'?json({},500):json({data:{accepted:[{id:'first-copy',originalFilename:'private-A.png'}],rejected:outcome==='partial'?[{filename:'rejected.png',reason:'Rejected'}]:[]}},201)));
 // Submit the original form as well as the visible recovery action: React state
 // or disabled controls alone must not allow another create/upload request.
 act(()=>{fireEvent.submit(originalForm);fireEvent.submit(originalForm);});
 expect(creates).toHaveBeenCalledTimes(1);expect(uploads).toHaveBeenCalledTimes(1);
 const heading=await screen.findByRole('heading',{name:'Ticket TKT-1 created'});expect(heading).toHaveFocus();expect(screen.getByText(/Ticket created successfully\. Attachment results could not be confirmed/)).toHaveAttribute('role','status');
 expect(uploads).toHaveBeenCalledWith(outcome==='partial'?['private-A.png','rejected.png']:['private-A.png']);
 if(outcome==='replacement') {
  fireEvent.click(screen.getByRole('button',{name:'Logout'}));await screen.findByRole('heading',{name:'Login'});fireEvent.change(screen.getByLabelText('Email'),{target:{value:'B@test.local'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'Initial123'}});fireEvent.submit(view.container.querySelector('form')!);await screen.findByRole('heading',{name:'My Tickets'});
  const events=vi.fn();window.addEventListener('session-access-changed',events);
  try{await act(async()=>held.resolve(denied('PASSWORD_CHANGE_REQUIRED')));expect(events).not.toHaveBeenCalled();expect(screen.queryByRole('heading',{name:'Ticket TKT-1 created'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Open Ticket to review and retry attachments'})).not.toBeInTheDocument();expect(window.location.pathname).toBe('/tickets');expect(creates).toHaveBeenCalledTimes(1);expect(uploads).toHaveBeenCalledTimes(1);}
  finally{window.removeEventListener('session-access-changed',events);}return;
 }
 fireEvent.click(screen.getByRole('button',{name:'Open Ticket to review and retry attachments'}));await screen.findByText('Original summary');expect(window.location.pathname).toBe('/tickets/ticket');
 if(outcome==='uncertain')await act(async()=>held.resolve(denied('PASSWORD_CHANGE_REQUIRED')));
 expect(creates).toHaveBeenCalledTimes(1);expect(uploads).toHaveBeenCalledTimes(1);expect(window.location.pathname).toBe('/tickets/ticket');
});
it.each(['success','partial','failure','network','AUTHENTICATION_REQUIRED','PASSWORD_CHANGE_REQUIRED'])('R-01: unmounted upload %s cannot navigate or emit access loss',async outcome=>{
 const held=deferred();const f=await setup(()=>Promise.resolve(json({data:ticket})),()=>held.promise.then(response=>{if(outcome==='network')throw Error('Network failure');return response;}));
 await fillCreation(f.view.container);f.submit();await waitFor(()=>expect(f.uploads()).toBe(1));
 const events=vi.fn();window.addEventListener('session-access-changed',events);
 try{f.view.unmount();await act(async()=>held.resolve(outcome==='success'?json({data:{accepted:[{originalFilename:'private-A.png'}],rejected:[]}}):outcome==='partial'?json({data:{accepted:[],rejected:[{filename:'private-A.png',reason:'Rejected'}]}}):outcome==='failure'?json({},500):denied(outcome)));expect(f.created).not.toHaveBeenCalled();expect(events).not.toHaveBeenCalled();}
 finally{window.removeEventListener('session-access-changed',events);}
});
it.each(['identity','role','inactive','password'] as const)('R-01: %s replacement invalidates a held creation even when fetch ignores abort',async change=>{
 const held=deferred();const f=await setup(()=>held.promise);await fillCreation(f.view.container);f.submit();
 const next:AuthUser={...user,role:'REQUESTER',isActive:true,mustChangePassword:false,...(change==='identity'?{id:'B'}:change==='role'?{role:'IT_STAFF' as const}:change==='inactive'?{isActive:false}:{mustChangePassword:true})};
 f.view.rerender(<CreateTicketScreen currentRequester={next} onCreated={f.created} onCancel={vi.fn()}/>);
 await act(async()=>held.resolve(json({data:ticket})));expect(f.created).not.toHaveBeenCalled();expect(f.uploads()).toBe(0);expect(screen.queryByText(/Ticket TKT-1 created/)).not.toBeInTheDocument();
});
it('R-01: obsolete finally cannot release a newer identity submission guard',async()=>{
 const old=deferred(),fresh=deferred();let n=0;const f=await setup(()=>++n===1?old.promise:fresh.promise,()=>Promise.resolve(json({data:{accepted:[{originalFilename:'private-A.png'}],rejected:[]}})));f.submit();
 f.view.rerender(<CreateTicketScreen currentRequester={{...user,id:'B'}} onCreated={f.created} onCancel={vi.fn()}/>);await fillCreation(f.view.container);f.submit();
 await act(async()=>old.resolve(json({data:ticket})));expect(screen.getByRole('button',{name:'Submitting Ticket...'})).toBeDisabled();f.submit();expect(f.inputs).toHaveLength(2);
 // No upload is needed to prove the new generation can still complete normally.
 await act(async()=>fresh.resolve(json({data:ticket})));expect(f.created).toHaveBeenCalledTimes(1);expect(f.uploads()).toBe(1);
});
it.each(['create','upload'] as const)('R-01: delayed %s error parsing rechecks context; current/default denials remain active',async stage=>{
 for(const code of ['AUTHENTICATION_REQUIRED','PASSWORD_CHANGE_REQUIRED']) for(const mode of ['obsolete','aborted','current','default']) {
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);let current=true;const events=vi.fn();window.addEventListener('session-access-changed',events);
  const response={ok:false,status:code==='AUTHENTICATION_REQUIRED'?401:403,json:async()=>{entered();await gate;return {error:{code}};},clone(){return this;}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));const controller=new AbortController();const context={signal:controller.signal,isCurrent:()=>current};
  try{const p=(stage==='create'?createTicket({categoryId:1,relatedSystemId:'system',summary:'Summary',description:'Description',clientRequestId:crypto.randomUUID()},mode==='default'?undefined:context):uploadTicketAttachments('ticket',[],mode==='default'?undefined:context)).catch(()=>undefined);await started;if(mode==='obsolete')current=false;if(mode==='aborted')controller.abort();release();await p;expect(events).toHaveBeenCalledTimes(mode==='obsolete'||mode==='aborted'?0:1);}
  finally{window.removeEventListener('session-access-changed',events);}
 }
});
it.each(['success','failure','AUTHENTICATION_REQUIRED','PASSWORD_CHANGE_REQUIRED','logout-only'])('R-01 App: A submits, logs out, B logs in, then old %s arrives',async outcome=>{
 window.history.replaceState({},'', '/tickets/new');const held=deferred();let actor='A';const a:AuthUser={...user,id:'A',role:'REQUESTER',isActive:true,mustChangePassword:false};const b={...a,id:'B',name:'Requester B'};const uploads=vi.fn();
 vi.stubGlobal('fetch',vi.fn((url:string,options:any)=>{
  if(url==='/api/auth/me')return Promise.resolve(json({data:actor==='A'?a:b}));
  if(url==='/api/auth/logout')return Promise.resolve(json({data:{}}));
  if(url==='/api/auth/login'){actor='B';return Promise.resolve(json({data:{user:b}}));}
  if(url.endsWith('/categories'))return Promise.resolve(json({data:[{id:1,name:'Category'}]}));
  if(url.endsWith('/related-systems'))return Promise.resolve(json({data:[{id:'system',name:'System'}]}));
  if(url.endsWith('/attachments')){uploads();return Promise.reject(Error('Obsolete upload must not start'));}
  if(options?.method==='POST')return held.promise;
  return Promise.resolve(json({data:[],pagination:{page:1,pageSize:10,totalItems:0,totalPages:0,hasNextPage:false,hasPreviousPage:false}}));
 }));
 const view=render(<App/>);await fillCreation(view.container);fireEvent.submit(view.container.querySelector('form')!);fireEvent.click(screen.getByRole('button',{name:'Logout'}));await screen.findByRole('heading',{name:'Login'});
 if(outcome!=='logout-only'){fireEvent.change(screen.getByLabelText('Email'),{target:{value:'B@test.local'}});fireEvent.change(screen.getByLabelText('Password'),{target:{value:'Initial123'}});fireEvent.submit(view.container.querySelector('form')!);await screen.findByRole('heading',{name:'My Tickets'});}
 const events=vi.fn();window.addEventListener('session-access-changed',events);
 try{await act(async()=>held.resolve(outcome==='success'||outcome==='logout-only'?json({data:ticket}):outcome==='failure'?json({},500):denied(outcome)));expect(uploads).not.toHaveBeenCalled();expect(events).not.toHaveBeenCalled();expect(window.location.pathname).toBe(outcome==='logout-only'?'/login':'/tickets');expect(screen.getByRole('heading',{name:outcome==='logout-only'?'Login':'My Tickets'})).toBeVisible();}
 finally{window.removeEventListener('session-access-changed',events);}
});
it('F-01: synchronous double submissions produce one request',async()=>{const hold=deferred();const f=await setup(()=>hold.promise);act(()=>{f.submit();f.submit();});expect(f.inputs).toHaveLength(1);await act(async()=>hold.resolve(json({data:ticket})));expect(f.created).toHaveBeenCalledTimes(1);});
it.each([false,true])('R-02: confirmed stage blocks edited/rapid retries; explicit new Ticket requires confirmation %s',async proceed=>{
 vi.spyOn(window,'confirm').mockReturnValue(proceed);let n=0;const f=await setup(()=>Promise.resolve(json({data:++n===1?ticket:{...ticket,id:'new-ticket',ticketNumber:'TKT-2'}})),()=>Promise.resolve(json({data:{accepted:[{originalFilename:'private-A.png'}],rejected:[]}})));
 await fillCreation(f.view.container);f.submit();await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));const originalForm=f.view.container.querySelector('form')!;fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'Edited after creation'}});act(()=>{fireEvent.submit(originalForm);fireEvent.submit(originalForm);});await screen.findByRole('heading',{name:'Ticket TKT-1 created'});expect(f.inputs).toHaveLength(1);expect(f.uploads()).toBe(1);
 fireEvent.click(screen.getByRole('button',{name:'Start a new Ticket'}));
 if(!proceed){expect(screen.getByRole('heading',{name:'Ticket TKT-1 created'})).toBeVisible();expect(f.inputs).toHaveLength(1);return;}
 expect(screen.getByRole('heading',{name:'Create Ticket'})).toHaveFocus();expect(screen.getByLabelText(/Ticket Summary/)).toHaveValue('');expect(screen.getByText('0 / 5 selected')).toBeVisible();await fillCreation(f.view.container);fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'Separate new intent'}});f.submit();await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(2));expect(f.inputs[1].clientRequestId).not.toBe(f.inputs[0].clientRequestId);expect(f.created.mock.calls[1][0].id).toBe('new-ticket');expect(f.uploads()).toBe(2);
});
it('R-02: malformed success cannot become a confirmed recovery Ticket',async()=>{
 let n=0;const f=await setup(()=>Promise.resolve(json({data:++n===1?{}:ticket})));f.submit();await screen.findByText('Unable to submit the ticket right now. Please try again.');f.submit();await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));expect(f.inputs[0]).toEqual(f.inputs[1]);
});
it('R-01: a failed session change preserves the same-identity uncertain retry key',async()=>{
 const held=deferred();let oldSession=true,n=0;const f=await setup(()=>++n===1?held.promise:Promise.resolve(json({data:ticket})),undefined,()=>oldSession);f.submit();oldSession=false;
 f.view.rerender(<CreateTicketScreen currentRequester={user} isSessionCurrent={()=>true} onCreated={f.created} onCancel={vi.fn()}/>);
 await act(async()=>held.resolve(json({data:ticket})));expect(f.created).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Submit Ticket'})).toBeEnabled();f.submit();await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));expect(f.inputs).toHaveLength(2);expect(f.inputs[0]).toEqual(f.inputs[1]);
});
it('R-01: an empty form recovers after role and identity replacement without retaining drafts',async()=>{
 const f=await setup(()=>Promise.resolve(json({data:ticket})));fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:''}});fireEvent.change(screen.getByLabelText(/^Description/),{target:{value:''}});
 f.view.rerender(<CreateTicketScreen currentRequester={{...user,role:'IT_STAFF'}} onCreated={f.created} onCancel={vi.fn()}/>);expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
 f.view.rerender(<CreateTicketScreen currentRequester={{...user,role:'REQUESTER'}} onCreated={f.created} onCancel={vi.fn()}/>);await screen.findByLabelText(/Ticket Summary/);
 f.view.rerender(<CreateTicketScreen currentRequester={{...user,id:'B'}} onCreated={f.created} onCancel={vi.fn()}/>);expect(await screen.findByLabelText(/Ticket Summary/)).toHaveValue('');expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it.each(['create','upload'] as const)('R-01: late %s success-body parsing cannot continue after unmount',async stage=>{
 let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 const response={ok:true,json:async()=>{entered();await gate;return {data:stage==='create'?ticket:{accepted:[{originalFilename:'private-A.png'}],rejected:[]}};}} as Response;
 const f=await setup(()=>Promise.resolve(stage==='create'?response:json({data:ticket})),()=>Promise.resolve(response));await fillCreation(f.view.container);await act(async()=>{f.submit();await started;});f.view.unmount();await act(async()=>release());expect(f.created).not.toHaveBeenCalled();expect(f.uploads()).toBe(stage==='create'?0:1);
});
it.each(['create','upload'] as const)('R-01: component context suppresses delayed denial parsing without relying on abort',async stage=>{
 let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 const response={ok:false,status:401,json:async()=>{entered();await gate;return {error:{code:'AUTHENTICATION_REQUIRED'}};},clone(){return this;}} as unknown as Response;
 const f=await setup(()=>Promise.resolve(stage==='create'?response:json({data:ticket})),()=>Promise.resolve(response));await fillCreation(f.view.container);await act(async()=>{f.submit();await started;});
 const events=vi.fn();window.addEventListener('session-access-changed',events);
 try{f.view.unmount();await act(async()=>release());expect(events).not.toHaveBeenCalled();expect(f.created).not.toHaveBeenCalled();expect(f.uploads()).toBe(stage==='create'?0:1);}
 finally{window.removeEventListener('session-access-changed',events);}
});
it('R-01: App invalidates at logout start, before the logout response unmounts the form',async()=>{
 window.history.replaceState({},'', '/tickets/new');const held=deferred(),logout=deferred();const uploads=vi.fn();
 vi.stubGlobal('fetch',vi.fn((url:string,options:any)=>{
  if(url==='/api/auth/me')return Promise.resolve(json({data:{...user,role:'REQUESTER',isActive:true,mustChangePassword:false}}));
  if(url==='/api/auth/logout')return logout.promise;
  if(url.endsWith('/categories'))return Promise.resolve(json({data:[{id:1,name:'Category'}]}));
  if(url.endsWith('/related-systems'))return Promise.resolve(json({data:[{id:'system',name:'System'}]}));
  if(url.endsWith('/attachments')){uploads();return Promise.reject(Error('Obsolete upload'));}
  return held.promise;
 }));
 const view=render(<App/>);await fillCreation(view.container);fireEvent.submit(view.container.querySelector('form')!);fireEvent.click(screen.getByRole('button',{name:'Logout'}));
 await act(async()=>held.resolve(json({data:ticket})));expect(uploads).not.toHaveBeenCalled();expect(window.location.pathname).toBe('/tickets/new');await act(async()=>logout.resolve(json({data:{}})));await screen.findByRole('heading',{name:'Login'});
});
it.each(['create','upload'] as const)('R-01: current %s authentication denials still invalidate access',async stage=>{
 for(const code of ['AUTHENTICATION_REQUIRED','PASSWORD_CHANGE_REQUIRED']) {
  const f=await setup(()=>Promise.resolve(stage==='create'?denied(code):json({data:ticket})),()=>Promise.resolve(denied(code)));await fillCreation(f.view.container);
  const events=vi.fn();window.addEventListener('session-access-changed',events);
  try{f.submit();await screen.findByText('Ticket creation is unavailable for your session or role.');expect(events).toHaveBeenCalledTimes(1);expect(f.created).not.toHaveBeenCalled();expect(screen.queryByText(/Ticket TKT-1 created/)).not.toBeInTheDocument();}
  finally{f.view.unmount();window.removeEventListener('session-access-changed',events);}
 }
});
it('uncertain same-intent retry retains the request ID and accepts replay',async()=>{let n=0;const f=await setup(()=>++n===1?Promise.reject(Error('Response lost after commit')):Promise.resolve(json({data:ticket})));f.submit();await screen.findByText('Unable to submit the ticket right now. Please try again.');fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'  Original summary  '}});f.submit();await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));expect(f.inputs[0]).toEqual(f.inputs[1]);});
it.each([false,true])('changed uncertain intent requires explicit confirmation: continue=%s',async allowed=>{const confirm=vi.spyOn(window,'confirm').mockReturnValue(allowed);let n=0;const f=await setup(()=>++n===1?Promise.reject(Error('lost')):Promise.resolve(json({data:ticket})));f.submit();await screen.findByText('Unable to submit the ticket right now. Please try again.');fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'Changed summary'}});f.submit();expect(confirm).toHaveBeenCalledTimes(1);if(allowed){await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));expect(f.inputs[0].clientRequestId).not.toBe(f.inputs[1].clientRequestId);}else expect(f.inputs).toHaveLength(1);});
it('definitive validation rejection allows corrected intent without uncertain confirmation',async()=>{const confirm=vi.spyOn(window,'confirm');let n=0;const f=await setup(()=>Promise.resolve(++n===1?json({error:{code:'VALIDATION_ERROR'}},400):json({data:ticket})));f.submit();await screen.findByText(/Some ticket information is invalid/);fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'Corrected summary'}});f.submit();await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));expect(confirm).not.toHaveBeenCalled();expect(f.inputs[0].clientRequestId).not.toBe(f.inputs[1].clientRequestId);});
it('invalid form sends no request or logical intent',async()=>{const f=await setup(()=>Promise.resolve(json({data:ticket})));fireEvent.change(screen.getByLabelText(/Ticket Summary/),{target:{value:'x'}});f.submit();expect(f.inputs).toHaveLength(0);});
it.each(['success','partial','capacity','total','network'])('F-07: truthful attachment outcome %s never recreates the Ticket',async mode=>{
 const accepted=mode==='success'?[{id:'a',originalFilename:'one.png'},{id:'b',originalFilename:'two.png'}]:mode==='partial'?[{id:'a',originalFilename:'one.png'}]:[];
 const rejected=mode==='success'?[]:(mode==='partial'?['two.png']:['one.png','two.png']).map(filename=>({filename,reason:mode==='capacity'?'Ticket attachment limit reached':'Unsupported file format'}));
 const upload=()=>mode==='network'?Promise.reject(Error('lost upload response')):Promise.resolve(json({data:{accepted,rejected,activeAttachmentCount:accepted.length}},mode==='total'||mode==='capacity'?400:201));
 const f=await setup(()=>Promise.resolve(json({data:ticket})),upload);
 fireEvent.change(f.view.container.querySelector('input[type=file]')!,{target:{files:[new File(['one'],'one.png',{type:'image/png'}),new File(['two'],'two.png',{type:'image/png'})]}});
 f.submit();
 if(mode==='success'){await waitFor(()=>expect(f.created).toHaveBeenCalledTimes(1));}
 else {
  expect(await screen.findByRole('heading',{name:/Ticket TKT-1 created/})).toHaveFocus();expect(f.created).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent(mode==='network'?'Attachment results could not be confirmed':`${accepted.length} attachment(s) uploaded; ${rejected.length} failed`);
  for(const file of rejected)if(mode!=='network')expect(screen.getByText(`${file.filename}: ${file.reason}`)).toBeVisible();
  if(mode==='network')expect(screen.getByText(/some uploads may already have succeeded/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:/Open Ticket/}));expect(f.created).toHaveBeenCalledTimes(1);
 }
 expect(f.inputs).toHaveLength(1);expect(f.uploads()).toBe(1);
});
