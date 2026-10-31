import { afterEach, describe, expect, it, vi } from "vitest";
import { getStaffTicket, updateStaffStatus } from "../../src/api.js";

afterEach(() => vi.unstubAllGlobals());
describe("Ticket workflow transport", () => {
  it("sends the exact last-read version and returns the new version", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { status: "RESOLVED", workflowVersion: 8 } })));
    vi.stubGlobal("fetch", fetch);
    expect(await updateStaffStatus("ticket/id", "RESOLVED", 7)).toEqual({ status: "RESOLVED", workflowVersion: 8 });
    expect(fetch).toHaveBeenCalledWith("/api/staff/tickets/ticket%2Fid/status", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "RESOLVED", expectedWorkflowVersion: 7 }) }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("retains every documented gate reason and discards arbitrary values", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "RESOLUTION_REQUIREMENTS_NOT_MET", message: "Review work", reasonCodes: ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS", "FOLLOW_UP_REQUIRED", "private-text", {}, null] } }), { status: 409 })));
    await expect(updateStaffStatus("ticket", "RESOLVED", 3)).rejects.toMatchObject({ code: "RESOLUTION_REQUIREMENTS_NOT_MET", status: 409, reasonCodes: ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS", "FOLLOW_UP_REQUIRED"] });
  });
  it.each(["CONFLICT", "VALIDATION_ERROR"])("preserves %s without retrying", async code => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "Review current state", reasonCodes: "unsafe" } }), { status: code === "CONFLICT" ? 409 : 400 }));
    vi.stubGlobal("fetch", fetch);
    await expect(updateStaffStatus("ticket", "OPEN", 0)).rejects.toMatchObject({ code, reasonCodes: [] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves additive staff-detail summary and version", async () => {
    const detail = { workflowVersion: 4, actionsTakenSummary: { totalItems: 2, pendingItems: 0, completedItems: 1, cancelledItems: 1, followUpRequiredItems: 0 }, resolutionEligibility: { eligible: true, reasonCodes: [] }, summary: "Existing ticket field" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: detail }))));
    expect(await getStaffTicket("ticket")).toEqual(detail);
  });
  it("uses a safe fallback for non-JSON failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private database diagnostic", { status: 500 })));
    await expect(updateStaffStatus("ticket", "OPEN", 0)).rejects.toMatchObject({ message: "Unable to complete the request.", status: 500 });
  });
});
