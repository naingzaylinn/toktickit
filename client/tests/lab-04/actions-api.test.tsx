import { afterEach, describe, expect, it, vi } from "vitest";
import { createAction, getActions, updateAction } from "../../src/api.js";

const content = { actionDescription: "Checked", actionResult: "Awaiting verification", followUpRequired: false, followUpNote: null, attachmentNotes: null, assigneeId: "10000000-0000-4000-8000-000000000001", clientRequestId: "20000000-0000-4000-8000-000000000001" };
afterEach(() => vi.unstubAllGlobals());
describe("Actions API transport", () => {
  it("uses role-scoped endpoints and retains pagination meta", async () => {
    const response = { data: [], meta: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 } };
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(response)));
    vi.stubGlobal("fetch", fetch);
    expect(await getActions("ticket/id", false, { page: 2, pageSize: 10 })).toEqual(response);
    expect(fetch.mock.calls[0][0]).toBe("/api/tickets/ticket%2Fid/actions?page=2&pageSize=10");
    await getActions("ticket", true, { pageSize: 20, focusActionId: "action" });
    expect(fetch.mock.calls[1][0]).toBe("/api/staff/tickets/ticket/actions?pageSize=20&focusActionId=action");
  });
  it.each([200, 201])("accepts create status %s and replay header with current DTO/version", async status => {
    const response = { data: { id: "action", version: 4, status: "COMPLETED" }, meta: { workflowVersion: 6 } };
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(response), { status, headers: status === 200 ? { "Idempotent-Replay": "true" } : {} }));
    vi.stubGlobal("fetch", fetch);
    expect(await createAction("ticket", content)).toEqual({ ...response, replay: status === 200 });
    expect(fetch).toHaveBeenCalledWith("/api/staff/tickets/ticket/actions", expect.objectContaining({ method: "POST", body: JSON.stringify(content) }));
  });
  it("sends expectedVersion in the existing same-origin PATCH", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {}, meta: { workflowVersion: 2 } })));
    vi.stubGlobal("fetch", fetch);
    await updateAction("ticket", "action/id", { expectedVersion: 3, status: "CANCELLED", actionResult: "Duplicate" });
    expect(fetch).toHaveBeenCalledWith("/api/staff/tickets/ticket/actions/action%2Fid", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ expectedVersion: 3, status: "CANCELLED", actionResult: "Duplicate" }) }));
    expect(JSON.stringify(fetch.mock.calls)).not.toMatch(/X-Development-Requester|performedById|editorId/);
  });
  it.each(["VALIDATION_ERROR", "INVALID_ACTION_ASSIGNEE"])("maps only safe string Action fields for %s", async code => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "Invalid", fields: { followUpNote: "Enter a note", assigneeId: "Select eligible staff", password: "Private", actionResult: { unsafe: true } } } }), { status: 400 })));
    await expect(createAction("ticket", content)).rejects.toMatchObject({ status: 400, code, fields: { followUpNote: "Enter a note", assigneeId: "Select eligible staff" } });
  });
  it.each(["CONFLICT", "ACTION_STATE_CONFLICT", "TICKET_WORKFLOW_CONFLICT", "IDEMPOTENCY_CONFLICT"])("retains %s without automatic retries", async code => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "Review current record" } }), { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    await expect(updateAction("ticket", "action", { expectedVersion: 1, actionResult: "Changed" })).rejects.toMatchObject({ code, status: 409 });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "PASSWORD_CHANGE_REQUIRED"]] as const)("announces session access change for %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "Session unavailable" } }), { status })));
    const changed = vi.fn(); window.addEventListener("session-access-changed", changed);
    try { await expect(getActions("ticket", false)).rejects.toMatchObject({ status, code }); expect(changed).toHaveBeenCalledOnce(); }
    finally { window.removeEventListener("session-access-changed", changed); }
  });
  it("uses a safe fallback for non-JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("database diagnostics", { status: 500 })));
    await expect(getActions("ticket", true)).rejects.toMatchObject({ message: "Unable to load Actions Taken.", status: 500 });
  });
});
