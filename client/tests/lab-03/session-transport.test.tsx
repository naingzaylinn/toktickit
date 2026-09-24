import {afterEach,describe,it,expect,vi} from "vitest";
import {createTicket,getMyTickets,getTicketDetail,getAttachmentContent,getCurrentUser} from "../../src/api.js";
afterEach(()=>vi.unstubAllGlobals());
describe("Session transport",()=>{
 it("requester APIs send no selected identity, role or legacy header",async()=>{
 const fetch=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({data:[]}),{status:200}));vi.stubGlobal("fetch",fetch);
 sessionStorage.setItem("toktickit_requester_id","forged");
 await createTicket({categoryId:1,relatedSystemId:"system",summary:"Summary",description:"Description",clientRequestId:"request"});await getMyTickets();await getTicketDetail("ticket");await getAttachmentContent("ticket","attachment");
 for(const [url,options] of fetch.mock.calls){expect(String(url)).not.toMatch(/requesterId|forged|role=/);expect(JSON.stringify(options)).not.toMatch(/X-Development-Requester|requesterId|forged|role/);}
 sessionStorage.clear();
 });
 it("protected 401 notifies the shell to discard protected content",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:"AUTHENTICATION_REQUIRED",message:"Sign in."}}),{status:401})));const notify=vi.fn();window.addEventListener("session-access-changed",notify);try{await expect(getMyTickets()).rejects.toMatchObject({status:401});expect(notify).toHaveBeenCalledOnce();}finally{window.removeEventListener("session-access-changed",notify);}});
 it("mandatory change rejection notifies the shell",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:"PASSWORD_CHANGE_REQUIRED",message:"Change password."}}),{status:403})));const notify=vi.fn();window.addEventListener("session-access-changed",notify);try{await expect(getMyTickets()).rejects.toMatchObject({status:403});expect(notify).toHaveBeenCalledOnce();}finally{window.removeEventListener("session-access-changed",notify);}});
 it("auth lookup failures cannot cause recursive session refresh",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:"AUTHENTICATION_REQUIRED",message:"Sign in."}}),{status:401})));const notify=vi.fn();window.addEventListener("session-access-changed",notify);try{await expect(getCurrentUser()).rejects.toMatchObject({status:401});expect(notify).not.toHaveBeenCalled();}finally{window.removeEventListener("session-access-changed",notify);}});
});
