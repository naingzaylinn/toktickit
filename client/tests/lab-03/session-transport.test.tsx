import {afterEach,describe,it,expect,vi} from "vitest";
import {createTicket,getMyTickets,getTicketDetail,getAttachmentContent,getCurrentUser,changePassword} from "../../src/api.js";
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

describe("Authentication field error transport", () => {
 it("preserves documented string fields and excludes unrelated or malformed metadata", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
   code: "VALIDATION_ERROR", message: "One or more fields are invalid.", fields: {
    newPassword: "Use 8 to 72 characters, including at least one letter and one number.",
    confirmPassword: "Password confirmation must match.", currentPassword: { secret: "internal" }, stack: "private detail",
   },
  } }), { status: 400 })));
  const error = await changePassword("Initial123", "Changed123", "Changed123").catch(cause => cause);
  expect(error).toHaveProperty("fields", {
   newPassword: "Use 8 to 72 characters, including at least one letter and one number.",
   confirmPassword: "Password confirmation must match.",
  });
 });
 it("does not interpret server failure metadata as field validation", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: {
   code: "INTERNAL_SERVER_ERROR", message: "Unable to complete the request.", fields: { newPassword: "internal detail" },
  } }), { status: 500 })));
  const error = await changePassword("Initial123", "Changed123", "Changed123").catch(cause => cause);
  expect(error).toHaveProperty("fields", {});
  expect(error).toHaveProperty("message", "Unable to complete the request.");
 });
});
