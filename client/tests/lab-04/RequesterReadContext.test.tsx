import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import RequesterDashboardScreen from "../../src/components/RequesterDashboardScreen.js";
import MyTicketsScreen from "../../src/components/MyTicketsScreen.js";
import { getRequesterDashboard, getStaffDashboard } from "../../src/api.js";
import { dashboardResponse, dashboardUser } from "./requesterDashboardFixture.js";
const deferred = () => { let resolve!: (r: Response) => void; const promise = new Promise<Response>(r => { resolve = r; }); return { promise, resolve }; };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const denied = (code: string) => json({ error: { code, message: "Access denied" } }, code === "AUTHENTICATION_REQUIRED" ? 401 : 403);
let events: ReturnType<typeof vi.fn>;
beforeEach(() => { window.history.replaceState({}, "", "/tickets"); events = vi.fn(); window.addEventListener("session-access-changed", events); });
afterEach(() => { window.removeEventListener("session-access-changed", events); vi.unstubAllGlobals(); });
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED", "LATE_SUCCESS", "LATE_FAILURE"])("old identity %s cannot clear a newer dashboard even when fetch ignores abort", async code => {
 const old = deferred(); const fetchMock = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(json(dashboardResponse())); vi.stubGlobal("fetch", fetchMock);
 const view = render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
 view.rerender(<RequesterDashboardScreen currentUser={{ ...dashboardUser, id: "B" }} onNavigate={vi.fn()}/>); await screen.findByRole("link", { name: "Total My Tickets 42" });
 expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
 await act(async () => { old.resolve(code === "LATE_SUCCESS" ? json({ ...dashboardResponse(), data: { ...dashboardResponse().data, totalTickets: 999 } }) : code === "LATE_FAILURE" ? json({ error: { code: "INTERNAL_SERVER_ERROR" } }, 500) : denied(code)); });
 expect(events).not.toHaveBeenCalled(); expect(screen.getByRole("link", { name: "Total My Tickets 42" })).toBeVisible(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("current dashboard %s dispatches access loss and clears content", async code => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(denied(code))); render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
 await screen.findByRole("alert"); expect(events).toHaveBeenCalledTimes(1); expect(screen.queryByRole("link", { name: /Total My Tickets/ })).not.toBeInTheDocument();
});
it("unmounted dashboard cannot dispatch late access loss", async () => {
 const old = deferred(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise)); const view = render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>); view.unmount();
 await act(async () => { old.resolve(denied("AUTHENTICATION_REQUIRED")); }); expect(events).not.toHaveBeenCalled();
});
it.each([401, 500, 200])("superseded same-user read ignores delayed status %s", async status => {
 const old = deferred(); const latest = deferred(); vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise));
 // Context validity is checked inside the real error parser, even without cancellation.
 let current = 1; const first = getRequesterDashboard({ isCurrent: () => current === 1 }).catch(() => undefined); current = 2;
 const second = getRequesterDashboard({ isCurrent: () => current === 2 }); latest.resolve(json(dashboardResponse())); expect((await second).data.totalTickets).toBe(42);
 old.resolve(status === 200 ? json(dashboardResponse()) : denied(status === 401 ? "AUTHENTICATION_REQUIRED" : "INTERNAL_SERVER_ERROR")); await first; expect(events).not.toHaveBeenCalled();
});
it("validity is rechecked after an already resolved response body", async () => {
 let valid = true; const body = deferred(); const response = { ok: false, status: 401, json: () => body.promise.then(() => ({ error: { code: "AUTHENTICATION_REQUIRED" } })) } as Response;
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response)); const read = getRequesterDashboard({ isCurrent: () => valid }).catch(() => undefined);
 await Promise.resolve(); valid = false; body.resolve(json({})); await read; expect(events).not.toHaveBeenCalled();
});
const emptyList = { data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("My Tickets old identity %s cannot dispatch access loss", async code => {
 const old = deferred(); let calls = 0; vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("/api/tickets?") ? (++calls === 1 ? old.promise : Promise.resolve(json(emptyList))) : Promise.resolve(json({ data: [] }))));
 const view = render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 view.rerender(<MyTicketsScreen currentRequester={{ ...dashboardUser, id: "B" }} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); await screen.findByText("No Tickets Found");
 await act(async () => { old.resolve(denied(code)); }); expect(events).not.toHaveBeenCalled(); expect(screen.getByText("No Tickets Found")).toBeVisible();
});
it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("My Tickets current %s dispatches access loss", async code => {
 vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/api/tickets?") ? denied(code) : json({ data: [] }))));
 render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); await screen.findByRole("alert"); expect(events).toHaveBeenCalledTimes(1); expect(screen.queryByText("No Tickets Found")).not.toBeInTheDocument();
});
it("default Staff transport still dispatches current-session access loss", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue(denied("AUTHENTICATION_REQUIRED"))); await expect(getStaffDashboard()).rejects.toThrow(); expect(events).toHaveBeenCalledTimes(1);
});
it("recoverable refresh failure retains real metrics without an access event", async () => {
 vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json(dashboardResponse())).mockResolvedValueOnce(json({ error: { code: "INTERNAL_SERVER_ERROR" } }, 500)));
 render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>); await screen.findByRole("link", { name: "Total My Tickets 42" }); fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await screen.findByRole("alert"); expect(screen.getByRole("link", { name: "Total My Tickets 42" })).toBeVisible(); expect(events).not.toHaveBeenCalled();
});

it.each(["AUTHENTICATION_REQUIRED", "PASSWORD_CHANGE_REQUIRED"])("same-ID role change invalidates old transport %s", async code => {
 const old = deferred(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise));
 const view = render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
 view.rerender(<RequesterDashboardScreen currentUser={{ ...dashboardUser, role: "IT_STAFF" }} onNavigate={vi.fn()}/>);
 await act(async () => { old.resolve(denied(code)); }); expect(events).not.toHaveBeenCalled(); expect(screen.queryByRole("link", { name: /Total My Tickets/ })).not.toBeInTheDocument();
});
it("aborted context suppresses access loss even when validity remains true", async () => {
 const old = deferred(); const controller = new AbortController(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise));
 const read = getRequesterDashboard({ signal: controller.signal, isCurrent: () => true }).catch(() => undefined);
 controller.abort(); old.resolve(denied("AUTHENTICATION_REQUIRED")); await read; expect(events).not.toHaveBeenCalled();
});
it.each([401, 500, 200])("My Tickets superseded filter response %s cannot replace current list", async status => {
 const old = deferred(); let calls = 0;
 vi.stubGlobal("fetch", vi.fn((url: string) => url.includes("/api/tickets?") ? (++calls === 1 ? old.promise : Promise.resolve(json(emptyList))) : Promise.resolve(json({ data: [] }))));
 render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Closed" } }); await screen.findByText("No Matching Tickets");
 await act(async () => { old.resolve(status === 200 ? json({ ...emptyList, data: [{ summary: "Obsolete row" }] }) : json({ error: { code: status === 401 ? "AUTHENTICATION_REQUIRED" : "INTERNAL_SERVER_ERROR" } }, status)); });
 expect(events).not.toHaveBeenCalled(); expect(screen.getByLabelText("Status")).toHaveValue("Closed"); expect(screen.getByText("No Matching Tickets")).toBeVisible(); expect(screen.queryByText("Obsolete row")).not.toBeInTheDocument(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("unmounted My Tickets and references cannot dispatch late access loss", async () => {
 const old = deferred(); vi.stubGlobal("fetch", vi.fn().mockReturnValue(old.promise));
 const view = render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); view.unmount();
 await act(async () => { old.resolve(denied("PASSWORD_CHANGE_REQUIRED")); }); expect(events).not.toHaveBeenCalled();
});
