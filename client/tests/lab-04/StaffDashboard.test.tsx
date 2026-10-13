import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { ApiError, getStaffDashboard } from "../../src/api.js";
import StaffDashboardScreen from "../../src/components/StaffDashboardScreen.js";
import { dashboardResponse, dashboardUser } from "./dashboardFixture.js";
vi.mock("../../src/api.js", async () => ({ ...await vi.importActual("../../src/api.js"), getStaffDashboard: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getStaffDashboard).mockResolvedValue(dashboardResponse()); });
const show = () => render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>);
async function failedDashboard(previousData: boolean) {
  if (!previousData) vi.mocked(getStaffDashboard).mockRejectedValueOnce(new Error("offline"));
  show();
  if (previousData) {
    await screen.findByRole("link", { name: "Total Tickets 42" });
    vi.mocked(getStaffDashboard).mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  }
  await screen.findByRole("button", { name: "Retry: Error" });
}
it.each([[false, true], [false, false], [true, true], [true, false]])(
  "keyboard Retry preserves focus: previous data %s, retry success %s", async (previousData, success) => {
    await failedDashboard(previousData);
    const user = userEvent.setup();
    let resolve!: (r: ReturnType<typeof dashboardResponse>) => void, reject!: (error: Error) => void;
    vi.mocked(getStaffDashboard).mockReturnValueOnce(new Promise((yes, no) => { resolve = yes; reject = no; }));
    const callsBefore = vi.mocked(getStaffDashboard).mock.calls.length;
    screen.getByRole("button", { name: "Retry: Error" }).focus(); await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Retry: Error" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "IT Staff Dashboard" })).toHaveFocus();
    expect(getStaffDashboard).toHaveBeenCalledTimes(callsBefore + 1);
    if (previousData) expect(screen.getByRole("link", { name: "Total Tickets 42" })).toBeVisible();
    await act(async () => { if (success) resolve(dashboardResponse()); else reject(new Error("offline again")); });
    expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    if (!success) {
      // A second keyboard retry remains usable after another failure.
      screen.getByRole("button", { name: "Retry: Error" }).focus(); await user.keyboard("{Enter}");
      await screen.findByRole("link", { name: "Total Tickets 42" });
      expect(screen.getByRole("button", { name: "Refresh" })).toHaveFocus();
      expect(getStaffDashboard).toHaveBeenCalledTimes(callsBefore + 2);
    }
  }
);
it.each([false, true])("Retry does not steal deliberately moved focus: previous data %s", async previousData => {
  await failedDashboard(previousData);
  render(<button>Another control</button>);
  let resolve!: (r: ReturnType<typeof dashboardResponse>) => void;
  vi.mocked(getStaffDashboard).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  screen.getByRole("button", { name: "Retry: Error" }).focus(); await userEvent.setup().keyboard("{Enter}");
  const other = screen.getByRole("button", { name: "Another control" }); other.focus();
  await act(async () => { resolve(dashboardResponse()); }); expect(other).toHaveFocus();
});
it("renders server values, scopes, all buckets and original-performer history", async () => {
  show(); await screen.findByRole("link", { name: "Total Tickets 42" });
  for (const name of ["Active Tickets 30", "Unassigned Active Tickets 11", "My Active Tickets 7", "Urgent IT Priority 4", "Closed 4"]) expect(screen.getByRole("link", { name })).toBeVisible();
  expect(screen.getByText("Actions originally recorded by you: 19")).toBeVisible(); expect(screen.getByText("Assignee: Other Worker (inactive)")).toBeVisible();
  expect(screen.getByRole("heading", { name: "IT Staff Dashboard" })).toBeVisible(); expect(screen.getByText("Operational overview")).toBeVisible();
  expect(document.querySelectorAll("time")).toHaveLength(3);
});
it("initial load contains no false zero metrics", () => {
  vi.mocked(getStaffDashboard).mockReturnValue(new Promise(() => {})); show();
  expect(screen.getByText("Loading dashboard...")).toBeVisible(); expect(screen.queryByRole("link", { name: /Total Tickets/ })).not.toBeInTheDocument();
});
it("genuine empty data retains zero drilldowns and helpful lists", async () => {
  const r = dashboardResponse(); r.data.totalTickets = r.data.activeTickets = r.data.unassignedActiveTickets = r.data.myActiveTickets = 0;
  Object.keys(r.data.byStatus).forEach(key => { r.data.byStatus[key as keyof typeof r.data.byStatus] = 0; });
  Object.keys(r.data.activeByItPriority).forEach(key => { r.data.activeByItPriority[key as keyof typeof r.data.activeByItPriority] = 0; });
  r.data.recentTickets = []; r.data.myActions = { totalItems: 0, items: [] }; vi.mocked(getStaffDashboard).mockResolvedValue(r); show();
  expect(await screen.findByRole("link", { name: "Total Tickets 0" })).toHaveAttribute("href", "/staff/tickets");
  expect(screen.getByText(/No recent Tickets/)).toBeVisible(); expect(screen.getByText("No Actions originally recorded by you.")).toBeVisible();
});
it("failed refresh retains truthful prior data and timestamp; retry restores current results", async () => {
  show(); await screen.findByRole("link", { name: "Total Tickets 42" });
  vi.mocked(getStaffDashboard).mockRejectedValueOnce(new Error("private secret")); fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  await screen.findByText(/Showing previously loaded data/); expect(screen.getByRole("link", { name: "Total Tickets 42" })).toBeVisible();
  expect(document.querySelector("time")?.dateTime).toBe("2026-10-13T02:00:00.000Z"); expect(screen.queryByText("private secret")).not.toBeInTheDocument();
  const r = dashboardResponse(); r.data.totalTickets = 55; r.meta.generatedAt = "2026-10-13T03:00:00.000Z";
  vi.mocked(getStaffDashboard).mockResolvedValueOnce(r); fireEvent.click(screen.getByRole("button", { name: "Retry: Error" }));
  await screen.findByRole("link", { name: "Total Tickets 55" }); expect(document.querySelector("time")?.dateTime).toBe(r.meta.generatedAt);
});
it("initial failure shows retry without metrics", async () => {
  vi.mocked(getStaffDashboard).mockRejectedValueOnce(new Error("offline")); show(); await screen.findByRole("alert");
  expect(screen.queryByRole("link", { name: /Total Tickets/ })).not.toBeInTheDocument(); fireEvent.click(screen.getByRole("button", { name: "Retry: Error" })); await screen.findByRole("link", { name: "Total Tickets 42" });
});
it.each([401, 403])("access loss %s clears protected results and controls", async status => {
  show(); await screen.findByRole("link", { name: "Total Tickets 42" }); vi.mocked(getStaffDashboard).mockRejectedValueOnce(new ApiError("FORBIDDEN", "secret", status));
  fireEvent.click(screen.getByRole("button", { name: "Refresh" })); await screen.findByText(/unavailable for your session or role/);
  expect(screen.queryByRole("link", { name: /Total Tickets/ })).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
});
it("identity change hides old data and ignores its late response", async () => {
  let release!: (r: ReturnType<typeof dashboardResponse>) => void;
  vi.mocked(getStaffDashboard).mockReturnValueOnce(new Promise(r => { release = r; }));
  const view = show(); const next = dashboardResponse(); next.data.totalTickets = 77; vi.mocked(getStaffDashboard).mockResolvedValueOnce(next);
  view.rerender(<StaffDashboardScreen currentUser={{ ...dashboardUser, id: "admin", role: "ADMINISTRATOR" }} onNavigate={vi.fn()}/>);
  await screen.findByRole("link", { name: "Total Tickets 77" }); await act(async () => { release(dashboardResponse()); });
  expect(screen.queryByRole("link", { name: "Total Tickets 42" })).not.toBeInTheDocument();
});
it("global session loss invalidates an outstanding refresh", async () => {
  show(); await screen.findByRole("link", { name: "Total Tickets 42" }); let release!: (r: ReturnType<typeof dashboardResponse>) => void;
  vi.mocked(getStaffDashboard).mockReturnValueOnce(new Promise(r => { release = r; })); fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
  act(() => { window.dispatchEvent(new Event("session-access-changed")); }); await act(async () => { release(dashboardResponse()); });
  expect(screen.queryByRole("link", { name: /Total Tickets/ })).not.toBeInTheDocument();
});
it("native card links are keyboard focusable and retain modified-click browser behavior", async () => {
  const navigate = vi.fn(); render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={navigate}/>);
  const link = await screen.findByRole("link", { name: "Total Tickets 42" }); link.focus(); expect(link).toHaveFocus();
  // Suppress jsdom's unimplemented browser navigation after checking our handler.
  const preventBrowserNavigation = (event: Event) => event.preventDefault();
  link.addEventListener("click", preventBrowserNavigation);
  fireEvent.click(link, { ctrlKey: true }); expect(navigate).not.toHaveBeenCalled();
  link.removeEventListener("click", preventBrowserNavigation);
  fireEvent.click(link); expect(navigate).toHaveBeenCalledWith("/staff/tickets"); await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
});
