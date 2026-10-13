import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { ApiError, getRequesterDashboard, getMyTickets } from "../../src/api.js";
import { dashboardResponse } from "./requesterDashboardFixture.js";
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); }); afterEach(() => { vi.unstubAllGlobals(); });
it("GET returns the exact server envelope with no query or identity overrides", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(dashboardResponse()))); expect(await getRequesterDashboard()).toEqual(dashboardResponse());
  expect(fetch).toHaveBeenCalledWith("/api/requester/dashboard", { headers: { Accept: "application/json" }, cache: "no-store" });
});
it("My Tickets serializes active intersection using Prisma status", async () => {
  vi.mocked(fetch).mockResolvedValue(new Response("{}")); await getMyTickets({ statusGroup: "active", currentStatus: "Closed", page: 2 });
  const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]), "http://local"); expect(Object.fromEntries(url.searchParams)).toEqual({ statusGroup: "active", currentStatus: "Closed", page: "2", pageSize: "10", sortBy: "newest" });
});
it.each([401, 403, 500])("preserves safe API errors at %s", async status => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: status === 403 ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR", message: "Safe message" } }), { status }));
  await expect(getRequesterDashboard()).rejects.toMatchObject({ status, message: "Safe message" });
});
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("signals session access loss for %s", async code => {
  const listener = vi.fn(); window.addEventListener("session-access-changed", listener);
  try { vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code, message: "Safe" } }), { status: code === "AUTHENTICATION_REQUIRED" ? 401 : 403 })); await expect(getRequesterDashboard()).rejects.toBeInstanceOf(ApiError); expect(listener).toHaveBeenCalledOnce(); }
  finally { window.removeEventListener("session-access-changed", listener); }
});
it("invalid error JSON uses safe fallback", async () => { vi.mocked(fetch).mockResolvedValue(new Response("private HTML", { status: 500 })); await expect(getRequesterDashboard()).rejects.toMatchObject({ message: "Unable to load your dashboard." }); });
