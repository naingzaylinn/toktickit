import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ApiError, getStaffDashboard, getStaffTickets } from "../../src/api.js";
import { dashboardResponse } from "./dashboardFixture.js";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); }); afterEach(() => { vi.unstubAllGlobals(); });
it("GET returns the exact server envelope with no query or identity overrides", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(dashboardResponse()))); expect(await getStaffDashboard()).toEqual(dashboardResponse());
  expect(fetch).toHaveBeenCalledWith("/api/staff/dashboard", { headers: { Accept: "application/json" }, cache: "no-store" });
});
it("Queue serializes active group alongside existing filters", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}")); await getStaffTickets({ statusGroup: "active", owner: "unassigned", itPriority: "URGENT", status: "CLOSED", page: 2 });
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), "http://local"); expect(Object.fromEntries(url.searchParams)).toEqual({ statusGroup: "active", owner: "unassigned", itPriority: "URGENT", status: "CLOSED", page: "2" });
});
it.each([401, 403, 500])("preserves safe API errors at %s", async status => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: status === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR", message: "Safe message" } }), { status }));
  await expect(getStaffDashboard()).rejects.toMatchObject({ status, message: "Safe message" });
});
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("signals session access loss for %s", async code => {
  const listener = vi.fn(); window.addEventListener("session-access-changed", listener);
  try { vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "Safe" } }), { status: code === "AUTHENTICATION_REQUIRED" ? 401 : 403 })); await expect(getStaffDashboard()).rejects.toBeInstanceOf(ApiError); expect(listener).toHaveBeenCalledOnce(); }
  finally { window.removeEventListener("session-access-changed", listener); }
});
it("invalid error JSON uses safe fallback", async () => { vi.mocked(fetch).mockResolvedValue(new Response("private HTML", { status: 500 })); await expect(getStaffDashboard()).rejects.toMatchObject({ message: "Unable to load the staff dashboard." }); });
