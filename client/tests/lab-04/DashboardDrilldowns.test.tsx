import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { getStaffDashboard, getStaffTickets, getCurrentUser } from "../../src/api.js";
import StaffDashboardScreen from "../../src/components/StaffDashboardScreen.js";
import StaffTicketQueueScreen from "../../src/components/StaffTicketQueueScreen.js";
import AppShell from "../../src/components/AppShell.js";
import App from "../../src/App.js";
import { dashboardResponse, dashboardUser } from "./dashboardFixture.js";
vi.mock("../../src/api.js", async () => ({ ...await vi.importActual("../../src/api.js"), getStaffDashboard: vi.fn(), getStaffTickets: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("../../src/components/SystemDiagnostic.js", () => ({ default: () => null }));
const queue = (total = 40, page = 1) => ({ data: [{ id: "ticket-1", ticketNumber: "TKT-1", summary: "Queue result", status: "OPEN" as const, requestedPriority: "HIGH" as const, itPriority: "URGENT" as const,
  owner: null, requester: { id: "requester", name: "Requester", email: "r@test" }, category: { id: 1, name: "Network" }, createdAt: "2020-01-01", updatedAt: "2020-01-01" }], meta: { page, pageSize: 20, totalItems: total, totalPages: 2 } });
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/staff/tickets"); vi.mocked(getStaffDashboard).mockResolvedValue(dashboardResponse()); vi.mocked(getStaffTickets).mockResolvedValue(queue()); vi.mocked(getCurrentUser).mockResolvedValue(dashboardUser); });
afterEach(() => { window.history.replaceState({}, "", "/"); });
it("every card and row uses the exact approved destination", async () => {
  render(<StaffDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>); await screen.findByRole("link", { name: "Total Tickets 42" });
  for (const [name, href] of [["Total Tickets 42", "/staff/tickets"], ["Active Tickets 30", "/staff/tickets?statusGroup=active"], ["Unassigned Active Tickets 11", "/staff/tickets?statusGroup=active&owner=unassigned"], ["My Active Tickets 7", "/staff/tickets?statusGroup=active&owner=staff-1"], ["TKT-1: Network repair", "/staff/tickets/ticket-1"], ["TKT-1: Original work", "/staff/tickets/ticket-1#action-action-1"], ["View all recent Tickets", "/staff/tickets?sort=updatedAt&order=desc"]]) expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  for (const status of Object.keys(dashboardResponse().data.byStatus)) expect(document.querySelector(`a[href="/staff/tickets?status=${status}"]`)).not.toBeNull();
  for (const priority of Object.keys(dashboardResponse().data.activeByItPriority)) expect(document.querySelector(`a[href="/staff/tickets?statusGroup=active&itPriority=${priority}"]`)).not.toBeNull();
  expect(screen.queryByRole("link", { name: /Actions originally recorded/ })).not.toBeInTheDocument();
});
it.each(["IT_STAFF", "ADMINISTRATOR", "REQUESTER"] as const)("shell role %s has appropriate navigation and original brand target", role => {
  render(<AppShell currentUser={{ ...dashboardUser, role }} onLogout={vi.fn()} activePath="/staff/dashboard"/>);
  if (role === "REQUESTER") { expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard"); expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current"); }
  else { expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page"); expect(screen.getByRole("link", { name: "Ticket Queue" })).not.toHaveAttribute("aria-current"); }
  expect(screen.getByRole("link", { name: "TokTickIT" })).toHaveAttribute("href", role === "REQUESTER" ? "/tickets" : "/staff/tickets");
});
it("initializes every Queue filter, sort and page from URL", async () => {
  window.history.replaceState({}, "", "/staff/tickets?statusGroup=active&owner=staff-1&status=OPEN&itPriority=URGENT&requestedPriority=HIGH&search=router&sort=ticketNumber&order=asc&page=2&pageSize=10");
  render(<StaffTicketQueueScreen currentUser={dashboardUser} onOpenTicket={vi.fn()}/>);
  await waitFor(() => expect(getStaffTickets).toHaveBeenCalledWith({ statusGroup: "active", owner: "staff-1", status: "OPEN", itPriority: "URGENT", requestedPriority: "HIGH", search: "router", sort: "ticketNumber", order: "asc", page: 2, pageSize: 10 }));
  expect(screen.getByLabelText("Ownership")).toHaveValue("staff-1"); expect(screen.getByLabelText("Status group")).toHaveValue("active");
});
it("pagination preserves predicates and reset clears the URL", async () => {
  window.history.replaceState({}, "", "/staff/tickets?statusGroup=active&owner=unassigned&itPriority=URGENT");
  render(<StaffTicketQueueScreen currentUser={dashboardUser} onOpenTicket={vi.fn()}/>); await screen.findByRole("button", { name: "Next" });
  fireEvent.click(screen.getByRole("button", { name: "Next" })); await waitFor(() => expect(new URLSearchParams(window.location.search).get("page")).toBe("2"));
  expect(new URLSearchParams(window.location.search).get("statusGroup")).toBe("active"); expect(new URLSearchParams(window.location.search).get("owner")).toBe("unassigned");
  fireEvent.click(screen.getByRole("button", { name: "Reset Queue" })); await waitFor(() => expect(window.location.search).toBe("")); expect(screen.getByLabelText("Status group")).toHaveValue("");
});
it("popstate restores controls/results and does not overwrite restored page", async () => {
  render(<StaffTicketQueueScreen currentUser={dashboardUser} onOpenTicket={vi.fn()}/>); await screen.findByRole("button", { name: "Next" });
  act(() => { window.history.pushState({}, "", "/staff/tickets?status=CLOSED&search=old&page=2"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await waitFor(() => expect(getStaffTickets).toHaveBeenLastCalledWith(expect.objectContaining({ status: "CLOSED", search: "old", page: 2 })));
  expect(screen.getByLabelText("Status")).toHaveValue("CLOSED"); expect(window.location.search).toContain("page=2");
});
it("superseded Queue response cannot replace newer filtered results", async () => {
  let release!: (r: ReturnType<typeof queue>) => void; vi.mocked(getStaffTickets).mockReturnValueOnce(new Promise(r => { release = r; }));
  render(<StaffTicketQueueScreen currentUser={dashboardUser} onOpenTicket={vi.fn()}/>); fireEvent.change(screen.getByLabelText("Status"), { target: { value: "CLOSED" } });
  await screen.findAllByText("Queue result"); const old = queue(); old.data[0].summary = "Obsolete result"; await act(async () => { release(old); }); expect(screen.queryByText("Obsolete result")).not.toBeInTheDocument();
});
it("App navigates dashboard to filtered Queue using pathname and search separately", async () => {
  window.history.replaceState({}, "", "/staff/dashboard"); render(<App/>); await screen.findByRole("link", { name: "Unassigned Active Tickets 11" });
  fireEvent.click(screen.getByRole("link", { name: "Unassigned Active Tickets 11" })); await screen.findByRole("heading", { name: "Ticket Queue" });
  expect(window.location.pathname).toBe("/staff/tickets"); expect(screen.getByLabelText("Ownership")).toHaveValue("unassigned");
  await waitFor(() => expect(getStaffTickets).toHaveBeenCalledWith(expect.objectContaining({ statusGroup: "active", owner: "unassigned", page: 1 })));
});
