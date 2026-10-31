import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiError, getRequesterDashboard } from "../../src/api.js";
import RequesterDashboardScreen from "../../src/components/RequesterDashboardScreen.js";
import { dashboardResponse, dashboardUser } from "./requesterDashboardFixture.js";
vi.mock("../../src/api.js", async () => ({ ...await vi.importActual("../../src/api.js"), getRequesterDashboard: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getRequesterDashboard).mockResolvedValue(dashboardResponse()); });
const show = () => render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
async function failedDashboard(previousData: boolean) {
  if (!previousData) vi.mocked(getRequesterDashboard).mockRejectedValueOnce(new Error("offline"));
  show();
  if (previousData) {
    await screen.findByRole("link", { name: "Total My Tickets 42" });
    vi.mocked(getRequesterDashboard).mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  }
  await screen.findByRole("button", { name: "Retry: Error" });
}
it.each([[false, true], [false, false], [true, true], [true, false]])(
  "keyboard Retry preserves focus: previous data %s, retry success %s", async (previousData, success) => {
    await failedDashboard(previousData);
    const user = userEvent.setup();
    let resolve!: (r: ReturnType<typeof dashboardResponse>) => void, reject!: (error: Error) => void;
    vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise((yes, no) => { resolve = yes; reject = no; }));
    const callsBefore = vi.mocked(getRequesterDashboard).mock.calls.length;
    screen.getByRole("button", { name: "Retry: Error" }).focus(); await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Retry: Error" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Requester Dashboard" })).toHaveFocus();
    expect(getRequesterDashboard).toHaveBeenCalledTimes(callsBefore + 1);
    if (previousData) expect(screen.getByRole("link", { name: "Total My Tickets 42" })).toBeVisible();
    await act(async () => { if (success) resolve(dashboardResponse()); else reject(new Error("offline again")); });
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    if (!success) {
      // A second keyboard retry remains usable after another failure.
      screen.getByRole("button", { name: "Retry: Error" }).focus(); await user.keyboard("{Enter}");
      await screen.findByRole("link", { name: "Total My Tickets 42" });
      expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
      expect(getRequesterDashboard).toHaveBeenCalledTimes(callsBefore + 2);
    }
  }
);
it.each([false, true])("Retry does not steal deliberately moved focus: previous data %s", async previousData => {
  await failedDashboard(previousData);
  render(<button>Another control</button>);
  let resolve!: (r: ReturnType<typeof dashboardResponse>) => void;
  vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  screen.getByRole("button", { name: "Retry: Error" }).focus(); await userEvent.setup().keyboard("{Enter}");
  const other = screen.getByRole("button", { name: "Another control" }); other.focus();
  await act(async () => { resolve(dashboardResponse()); }); expect(other).toHaveFocus();
});
it("renders server values, all status buckets and both lists", async () => {
  show(); await screen.findByRole("link", { name: "Total My Tickets 42" });
  for (const name of ["Active Tickets 30", "Waiting for you 6", "Resolved Tickets 4", "Closed 4"]) expect(screen.getByRole("link", { name })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Recently Updated Resolved Tickets" })).toBeVisible();
  expect(screen.getByText("Your ticket overview: My Tickets")).toBeVisible(); expect(document.querySelectorAll("time")).toHaveLength(3);
});
it("initial load contains no false zero metrics", () => {
  vi.mocked(getRequesterDashboard).mockReturnValue(new Promise(() => {})); show();
  expect(screen.getByText("Loading dashboard...")).toBeVisible(); expect(screen.queryByRole("link", { name: /Total My Tickets/ })).not.toBeInTheDocument();
});
it("genuine empty data retains zero drilldowns and helpful lists", async () => {
  const r = dashboardResponse(); r.data.totalTickets = r.data.activeTickets = r.data.waitingForRequesterTickets = r.data.resolvedTickets = 0;
  Object.keys(r.data.byStatus).forEach(key => { r.data.byStatus[key as keyof typeof r.data.byStatus] = 0; });
  r.data.recentTickets = []; r.data.resolvedTicketsRecent = []; vi.mocked(getRequesterDashboard).mockResolvedValue(r); show();
  expect(await screen.findByRole("link", { name: "Total My Tickets 0" })).toHaveAttribute("href", "/tickets");
  expect(screen.getByText(/No recent Tickets/)).toBeVisible(); expect(screen.getByRole("link", { name: "Create Ticket" })).toHaveAttribute("href", "/tickets/new");
});
it("failed refresh retains truthful prior data and timestamp; retry restores current results", async () => {
  show(); await screen.findByRole("link", { name: "Total My Tickets 42" });
  vi.mocked(getRequesterDashboard).mockRejectedValueOnce(new Error("private secret")); fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText(/Showing previously loaded data/); expect(screen.getByRole("link", { name: "Total My Tickets 42" })).toBeVisible();
  expect(document.querySelector("time")?.dateTime).toBe("2026-10-13T02:00:00.000Z"); expect(screen.queryByText("private secret")).not.toBeInTheDocument();
  const r = dashboardResponse(); r.data.totalTickets = 55; r.meta.generatedAt = "2026-10-13T03:00:00.000Z";
  vi.mocked(getRequesterDashboard).mockResolvedValueOnce(r); fireEvent.click(screen.getByRole("button", { name: "Retry: Error" }));
  await screen.findByRole("link", { name: "Total My Tickets 55" }); expect(document.querySelector("time")?.dateTime).toBe(r.meta.generatedAt);
});
it("initial failure shows retry without metrics", async () => {
  vi.mocked(getRequesterDashboard).mockRejectedValueOnce(new Error("offline")); show(); await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: /Total My Tickets/ })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Retry: Error" })); await screen.findByRole("link", { name: "Total My Tickets 42" });
});
it.each([401, 403])("access loss %s clears protected results and controls", async status => {
  show(); await screen.findByRole("link", { name: "Total My Tickets 42" }); vi.mocked(getRequesterDashboard).mockRejectedValueOnce(new ApiError("FORBIDDEN", "secret", status));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await screen.findByText(/unavailable for your session or role/);
  expect(screen.queryByRole("link", { name: /Total My Tickets/ })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
});
it("identity change hides old data and ignores its late response", async () => {
  let release!: (r: ReturnType<typeof dashboardResponse>) => void;
  vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise(r => { release = r; }));
  const view = show(); const next = dashboardResponse(); next.data.totalTickets = 77; vi.mocked(getRequesterDashboard).mockResolvedValueOnce(next);
  view.rerender(<RequesterDashboardScreen currentUser={{ ...dashboardUser, id: "admin", role: "REQUESTER" }} onNavigate={vi.fn()}/>);
  await screen.findByRole("link", { name: "Total My Tickets 77" }); await act(async () => { release(dashboardResponse()); });
  expect(screen.queryByRole("link", { name: "Total My Tickets 42" })).not.toBeInTheDocument();
});
it("global session loss invalidates an outstanding refresh", async () => {
  show(); await screen.findByRole("link", { name: "Total My Tickets 42" }); let release!: (r: ReturnType<typeof dashboardResponse>) => void;
  vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise(r => { release = r; })); fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  act(() => { window.dispatchEvent(new Event("session-access-changed")); }); await act(async () => { release(dashboardResponse()); });
  expect(screen.queryByRole("link", { name: /Total My Tickets/ })).not.toBeInTheDocument();
});
it("native card links are keyboard focusable and retain modified-click browser behavior", async () => {
  const navigate = vi.fn(); render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={navigate}/>);
  const link = await screen.findByRole("link", { name: "Total My Tickets 42" }); link.focus(); expect(link).toHaveFocus();
  // Suppress jsdom's unimplemented browser navigation after checking our handler.
  const preventBrowserNavigation = (event: Event) => event.preventDefault();
  link.addEventListener("click", preventBrowserNavigation);
  fireEvent.click(link, { ctrlKey: true }); expect(navigate).not.toHaveBeenCalled();
  link.removeEventListener("click", preventBrowserNavigation);
  fireEvent.click(link); expect(navigate).toHaveBeenCalledWith("/tickets"); await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
});

it("same-ID role loss invalidates data and its late failure", async () => {
 let reject!: (e: Error) => void; vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise((_, no) => { reject = no; }));
 const view = show(); view.rerender(<RequesterDashboardScreen currentUser={{ ...dashboardUser, role: "IT_STAFF" }} onNavigate={vi.fn()}/>);
 await screen.findByText(/unavailable for your session or role/); await act(async () => { reject(new ApiError("FORBIDDEN", "old", 403)); }); expect(screen.queryByRole("link", { name: /^Total My Tickets/ })).not.toBeInTheDocument(); expect(getRequesterDashboard).toHaveBeenCalledTimes(1);
});
it("late prior-identity failure cannot clear the next Requester", async () => {
 let reject!: (e: Error) => void; vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise((_, no) => { reject = no; }));
 const view = show(); const next = dashboardResponse(); next.data.totalTickets = 77; vi.mocked(getRequesterDashboard).mockResolvedValueOnce(next);
 view.rerender(<RequesterDashboardScreen currentUser={{ ...dashboardUser, id: "new" }} onNavigate={vi.fn()}/>); await screen.findByRole("link", { name: "Total My Tickets 77" });
 await act(async () => { reject(new ApiError("FORBIDDEN", "old", 403)); }); expect(screen.getByRole("link", { name: "Total My Tickets 77" })).toBeVisible();
});
it("unmount invalidates pending response and never persists data", async () => {
 const storage = vi.spyOn(Storage.prototype, "setItem"); let release!: (r: ReturnType<typeof dashboardResponse>) => void;
 vi.mocked(getRequesterDashboard).mockReturnValueOnce(new Promise(r => { release = r; })); const view = show(); view.unmount(); await act(async () => { release(dashboardResponse()); }); expect(storage).not.toHaveBeenCalled(); storage.mockRestore();
});
