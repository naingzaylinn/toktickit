import {describe,it,expect} from "vitest";
import request from "supertest";
import {app} from "../../src/app.js";
import {requesterCookie} from "../lab-03/sessionFixture.js";
describe("Retired Development Requester boundary",()=>{
 it.each(["a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d","e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b","00000000-0000-0000-0000-000000000000","invalid",""])("a header never authenticates: %s",async id=>{
 expect((await request(app).post("/api/v1/tickets").set("X-Development-Requester-Id",id).send({})).status).toBe(401);
 });
 it("does not expose the retired selector endpoint",async()=>{
 const cookie=await requesterCookie("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
 const response=await request(app).get("/api/v1/development-requesters").set("Cookie",cookie);
 expect(response.status).toBe(404);expect(response.body).not.toHaveProperty("data");
 });
});
