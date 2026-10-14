import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StaffDashboardScreen from "../../src/components/StaffDashboardScreen.js";
import { getStaffDashboard } from "../../src/api.js";
import { dashboardResponse, dashboardUser } from "./dashboardFixture.js";
const deferred = () => { let resolve!: (value: Response) => void; const promise = new Promise<Response>(r => { resolve = r; }); return { resolve, promise }; };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const denial = (code: string) => json({ error: { code, message: "Denied" } }, code === "AUTHENTICATION_REQUIRED" ? 401 : 403);
let events: ReturnType<typeof vi.fn>;
beforeEach(() => { events = vi.fn(); window.addEventListener("session-access-changed", events); });
afterEach(() => { window.removeEventListener("session-access-changed", events); vi.unstubAllGlobals(); });
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED", "success", "failure"])("obsolete %s cannot clear another staff identity when abort is ignored", async code => {
 const old = deferred(); const fetch = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(json(dashboardResponse())); vi.stubGlobal("fetch", fetch);
 const view = render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
 view.rerender(<StaffDashboardScreen currentUser={{ ...dashboardUser, id: "new" }} onNavigate={vi.fn()}/>);
 await screen.findByRole("link", { name: "Total Tickets 42" });
 await act(async () => { old.resolve(code === "success" ? json({ ...dashboardResponse(), data: { ...dashboardResponse().data, totalTickets: 999 } }) : code === "failure" ? json({}, 500) : denial(code)); });
 expect(events).not.toHaveBeenCalled(); expect(screen.getByRole("link", { name: "Total Tickets 42" })).toBeVisible();
 expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("unmounted %s cannot dispatch global access loss", async code => {
 const old = deferred(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise));
 const view = render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>); view.unmount();
 await act(async () => old.resolve(denial(code))); expect(events).not.toHaveBeenCalled();
});
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("current %s still invalidates access", async code => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(denial(code))); render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
 await screen.findByRole("alert"); expect(events).toHaveBeenCalledTimes(1); expect(screen.queryByRole("link", { name: /Total Tickets/ })).not.toBeInTheDocument();
});
it.each(["ADMINISTRATOR", "REQUESTER"] as const)("same-ID role change to %s invalidates the old read", async role => {
 const old = deferred(); vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(json(dashboardResponse())));
 const view = render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
 view.rerender(<StaffDashboardScreen currentUser={{ ...dashboardUser, role }} onNavigate={vi.fn()}/>);
 await act(async () => old.resolve(denial("PASSWORD_CHANGE_REQUIRED"))); expect(events).not.toHaveBeenCalled();
 if (role === "REQUESTER") expect(screen.queryByRole("link", { name: /Total Tickets/ })).not.toBeInTheDocument();
});
it("rechecks currency after delayed error-body parsing", async () => {
 const body = deferred(); let current = true;
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => body.promise.then(() => ({ error: { code: "AUTHENTICATION_REQUIRED" } })) }));
 const pending = getStaffDashboard({ isCurrent: () => current }).catch(() => undefined);
 await Promise.resolve(); current = false; body.resolve(json({})); await pending; expect(events).not.toHaveBeenCalled();
});
