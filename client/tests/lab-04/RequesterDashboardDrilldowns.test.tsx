import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { getRequesterDashboard, getMyTickets, getCurrentUser, getTicketCategories, getRelatedSystems, requesterStatusFromDashboard, ApiError } from "../../src/api.js";
import RequesterDashboardScreen from "../../src/components/RequesterDashboardScreen.js";
import MyTicketsScreen from "../../src/components/MyTicketsScreen.js";
import App from "../../src/App.js";
import { dashboardResponse, dashboardUser } from "./requesterDashboardFixture.js";
vi.mock("../../src/api.js", async () => ({ ...await vi.importActual("../../src/api.js"), getRequesterDashboard: vi.fn(), getMyTickets: vi.fn(), getCurrentUser: vi.fn(), getTicketCategories: vi.fn(), getRelatedSystems: vi.fn() }));
vi.mock("../../src/components/SystemDiagnostic.js", () => ({ default: () => null }));
vi.mock("../../src/components/TicketDetailScreen.js", () => ({ default: ({ ticketId, onBack }: { ticketId: string; onBack: () => void }) => <><h1>Detail {ticketId}</h1><button onClick={onBack}>Back to My Tickets</button></> }));
const list = (summary = "Owned result") => ({ data: [{ id: "ticket-1", ticketNumber: "TKT-1", summary, currentStatus: "Resolved" as const, requestedPriority: "High" as const, category: { id: 1, name: "Network" }, relatedSystem: { id: "system", name: "Network" }, activeAttachmentCount: 0, ticketDate: "2020-01-01", createdAt: "2020-01-01", updatedAt: "2020-01-01" }], pagination: { page: 1, pageSize: 10, totalItems: 30, totalPages: 3, hasNextPage: true, hasPreviousPage: false } });
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/tickets"); vi.mocked(getRequesterDashboard).mockResolvedValue(dashboardResponse()); vi.mocked(getMyTickets).mockResolvedValue(list()); vi.mocked(getCurrentUser).mockResolvedValue(dashboardUser); vi.mocked(getTicketCategories).mockResolvedValue([]); vi.mocked(getRelatedSystems).mockResolvedValue([]); });
afterEach(() => { window.history.replaceState({}, "", "/"); });
it("all approved cards, buckets and row links map explicitly", async () => {
 render(<RequesterDashboardScreen currentUser={dashboardUser} onNavigate={vi.fn()}/>); await screen.findByRole("link", { name: "Total My Tickets 42" });
 for (const [name, href] of [["Total My Tickets 42", "/tickets"], ["Active Tickets 30", "/tickets?statusGroup=active"], ["Waiting for you 6", "/tickets?currentStatus=WaitingForRequester"], ["Resolved Tickets 4", "/tickets?currentStatus=Resolved"], ["TKT-1: Network repair", "/tickets/ticket-1"], ["TKT-2: Resolved repair", "/tickets/ticket-2"], ["View all recently updated Tickets", "/tickets?sortBy=recentlyUpdated"], ["View all recently updated resolved Tickets", "/tickets?currentStatus=Resolved&sortBy=recentlyUpdated"]]) expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
 for (const status of Object.values(requesterStatusFromDashboard)) expect(document.querySelector(`a[href="/tickets?currentStatus=${status}"]`)).not.toBeNull();
});
it("initializes all list query controls and preserves them through pagination/reset", async () => {
 window.history.replaceState({}, "", "/tickets?statusGroup=active&currentStatus=Open&q=router&categoryId=1&relatedSystemId=system&requestedPriority=High&sortBy=recentlyUpdated&page=2&pageSize=20");
 render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 await waitFor(() => expect(getMyTickets).toHaveBeenCalledWith({ statusGroup: "active", currentStatus: "Open", q: "router", categoryId: 1, relatedSystemId: "system", requestedPriority: "High", sortBy: "recentlyUpdated", page: 2, pageSize: 20 }, expect.objectContaining({ isCurrent: expect.any(Function) })));
 expect(screen.getByLabelText("Status")).toHaveValue("Open"); expect(screen.getByLabelText("Status group")).toHaveValue("active");
 fireEvent.click(screen.getByRole("button", { name: "Next" })); await waitFor(() => expect(new URLSearchParams(window.location.search).get("page")).toBe("3")); expect(window.location.search).toContain("sortBy=recentlyUpdated");
 fireEvent.click(screen.getByRole("button", { name: "Clear Filters" })); await waitFor(() => expect(window.location.search).toBe(""));
});
it("popstate restores filters and page without resetting restored pagination", async () => {
 render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); await screen.findAllByText("Owned result");
 act(() => { window.history.pushState({}, "", "/tickets?currentStatus=Closed&q=old&page=2"); window.dispatchEvent(new PopStateEvent("popstate")); });
 await waitFor(() => expect(getMyTickets).toHaveBeenLastCalledWith(expect.objectContaining({ currentStatus: "Closed", q: "old", page: 2 }), expect.objectContaining({ isCurrent: expect.any(Function) })));
 expect(screen.getByLabelText("Status")).toHaveValue("Closed"); expect(window.location.search).toContain("page=2");
});
it("App dashboard drilldown, detail return and query/hash independence", async () => {
 window.history.replaceState({}, "", "/dashboard"); render(<App/>); await screen.findByRole("link", { name: "Resolved Tickets 4" });
 fireEvent.click(screen.getByRole("link", { name: "Resolved Tickets 4" })); await screen.findAllByText("Owned result");
 const returnUrl = window.location.pathname + window.location.search;
 fireEvent.click(screen.getAllByText("Owned result")[0]); await screen.findByRole("heading", { name: "Detail ticket-1" });
 act(() => { window.history.replaceState(window.history.state, "", "/tickets/ticket-1?x=y#irrelevant"); window.dispatchEvent(new PopStateEvent("popstate")); });
 expect(screen.getByRole("heading", { name: "Detail ticket-1" })).toBeVisible();
 fireEvent.click(screen.getByRole("button", { name: "Back to My Tickets" })); await screen.findByRole("heading", { name: "My Tickets" }); expect(window.location.pathname + window.location.search).toBe(returnUrl);
});
it("direct detail entry falls back to unfiltered My Tickets", async () => {
 window.history.replaceState({}, "", "/tickets/direct-id#ignored"); render(<App/>); await screen.findByRole("heading", { name: "Detail direct-id" }); fireEvent.click(screen.getByRole("button", { name: "Back to My Tickets" })); await screen.findByRole("heading", { name: "My Tickets" }); expect(window.location.search).toBe("");
});
it("late list success cannot replace a newer filter", async () => {
 let release!: (r: ReturnType<typeof list>) => void; vi.mocked(getMyTickets).mockReturnValueOnce(new Promise(r => { release = r; }));
 render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Closed" } }); await screen.findAllByText("Owned result"); await act(async () => { release(list("Foreign stale")); }); expect(screen.queryByText("Foreign stale")).not.toBeInTheDocument();
});
it.each([false, true])("identity/role changes invalidate prior list request (role=%s)", async sameId => {
 let reject!: (r: Error) => void; vi.mocked(getMyTickets).mockReturnValueOnce(new Promise((_, no) => { reject = no; }));
 const view = render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 view.rerender(<MyTicketsScreen currentRequester={{ ...dashboardUser, ...(sameId ? { role: "IT_STAFF" } : { id: "new" }) }} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 await screen.findAllByText("Owned result"); await act(async () => { reject(new ApiError("FORBIDDEN", "old", 403)); }); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("failure has no false empty message; global loss clears outstanding list", async () => {
 vi.mocked(getMyTickets).mockRejectedValueOnce(new Error("offline")); render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); await screen.findByRole("alert"); expect(screen.queryByText("No Tickets Found")).not.toBeInTheDocument();
 let release!: (r: ReturnType<typeof list>) => void; vi.mocked(getMyTickets).mockReturnValueOnce(new Promise(r => { release = r; })); fireEvent.click(screen.getByRole("button", { name: "Retry: Error" }));
 act(() => { window.dispatchEvent(new Event("session-access-changed")); }); await act(async () => { release(list()); }); expect(screen.queryByText("Owned result")).not.toBeInTheDocument(); expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
});

it("dashboard row after a list visit does not inherit unrelated detail return state", async () => {
 window.history.replaceState({}, "", "/tickets?currentStatus=Closed"); render(<App/>); await screen.findAllByText("Owned result");
 fireEvent.click(screen.getAllByText("Owned result")[0]); await screen.findByRole("heading", { name: "Detail ticket-1" });
 act(() => { window.history.pushState({}, "", "/dashboard"); window.dispatchEvent(new PopStateEvent("popstate")); }); await screen.findByRole("link", { name: "TKT-1: Network repair" });
 fireEvent.click(screen.getByRole("link", { name: "TKT-1: Network repair" })); await screen.findByRole("heading", { name: "Detail ticket-1" }); fireEvent.click(screen.getByRole("button", { name: "Back to My Tickets" })); await screen.findByRole("heading", { name: "My Tickets" }); expect(window.location.search).toBe("");
});

it("recent-only URL can reset sort and page without claiming filter no-results", async () => {
 window.history.replaceState({}, "", "/tickets?sortBy=recentlyUpdated&page=2"); render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); await screen.findAllByText("Owned result");
 expect(screen.getByRole("button", { name: "Clear Filters" })).toBeEnabled(); fireEvent.click(screen.getByRole("button", { name: "Clear Filters" })); await waitFor(() => expect(window.location.search).toBe("")); expect(screen.getByLabelText("Sort By")).toHaveValue("newest");
});

it("restored Detail history entries retain their own filtered list return URLs", async () => {
 const first = "/tickets?currentStatus=Resolved&sortBy=recentlyUpdated&page=2";
 window.history.replaceState({}, "", first); render(<App/>); await screen.findAllByText("Owned result");
 fireEvent.click(screen.getAllByText("Owned result")[0]); await screen.findByRole("heading", { name: "Detail ticket-1" });
 const firstState = window.history.state;
 act(() => { window.history.pushState({}, "", "/tickets?currentStatus=Closed"); window.dispatchEvent(new PopStateEvent("popstate")); });
 await screen.findAllByText("Owned result"); fireEvent.click(screen.getAllByText("Owned result")[0]); await screen.findByRole("heading", { name: "Detail ticket-1" });
 const secondState = window.history.state;
 act(() => { window.history.pushState({}, "", "/dashboard"); window.dispatchEvent(new PopStateEvent("popstate")); }); await screen.findByRole("link", { name: "Total My Tickets 42" });
 act(() => { window.history.replaceState(firstState, "", "/tickets/ticket-1"); window.dispatchEvent(new PopStateEvent("popstate")); });
 await screen.findByRole("heading", { name: "Detail ticket-1" }); fireEvent.click(screen.getByRole("button", { name: "Back to My Tickets" })); await screen.findAllByText("Owned result");
 expect(window.location.pathname + window.location.search).toBe(first);
 act(() => { window.history.replaceState(secondState, "", "/tickets/ticket-1"); window.dispatchEvent(new PopStateEvent("popstate")); });
 await screen.findByRole("heading", { name: "Detail ticket-1" }); fireEvent.click(screen.getByRole("button", { name: "Back to My Tickets" })); await screen.findAllByText("Owned result");
 expect(window.location.search).toBe("?currentStatus=Closed");
});
it.each(["categoryId=2", "relatedSystemId=old-system", "categoryId=2&relatedSystemId=old-system"])("historical reference selection survives pagination and restoration: %s", async filters => {
 vi.mocked(getTicketCategories).mockResolvedValue([{ id: 1, name: "Active category" }]);
 vi.mocked(getRelatedSystems).mockResolvedValue([{ id: "active-system", name: "Active system" }]);
 window.history.replaceState({}, "", "/tickets?" + filters); render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>); await screen.findAllByText("Owned result");
 const assertSelected = () => {
  if (filters.includes("categoryId")) { expect(screen.getByLabelText("Category")).toHaveValue("2"); expect(screen.getByRole("option", { name: "Previously selected category (ID: 2)" })).toBeInTheDocument(); }
  if (filters.includes("relatedSystemId")) { expect(screen.getByLabelText("Related System")).toHaveValue("old-system"); expect(screen.getByRole("option", { name: "Previously selected system (ID: old-system)" })).toBeInTheDocument(); }
 };
 expect(screen.getByRole("option", { name: "Active category" })).toHaveValue("1"); expect(screen.getByRole("option", { name: "Active system" })).toHaveValue("active-system");
 assertSelected(); fireEvent.click(screen.getByRole("button", { name: "Next" })); await waitFor(() => expect(window.location.search).toContain("page=2")); assertSelected();
 const query = vi.mocked(getMyTickets).mock.calls.at(-1)![0]!;
 if (filters.includes("categoryId")) expect(query.categoryId).toBe(2);
 if (filters.includes("relatedSystemId")) expect(query.relatedSystemId).toBe("old-system");
 fireEvent.click(screen.getByRole("button", { name: "Clear Filters" })); await waitFor(() => expect(window.location.search).toBe("")); expect(screen.queryByText(/Previously selected/)).not.toBeInTheDocument();
 act(() => { window.history.pushState({}, "", "/tickets?" + filters); window.dispatchEvent(new PopStateEvent("popstate")); }); await screen.findAllByText("Owned result"); assertSelected();
});
it("out-of-range page uses totals and recovers without dropping filters or sort", async () => {
 vi.mocked(getMyTickets).mockResolvedValueOnce({ data: [], pagination: { page: 99, pageSize: 10, totalItems: 1, totalPages: 1, hasPreviousPage: true, hasNextPage: false } });
 window.history.replaceState({}, "", "/tickets?currentStatus=Resolved&sortBy=recentlyUpdated&page=99"); render(<MyTicketsScreen currentRequester={dashboardUser} onCreateTicket={vi.fn()} onOpenTicket={vi.fn()}/>);
 await screen.findByText("No Tickets on This Page"); expect(screen.queryByText(/not submitted/)).not.toBeInTheDocument(); expect(screen.queryByText("No Matching Tickets")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("button", { name: "Go to First Page" })); await screen.findAllByText("Owned result");
 expect(window.location.search).toBe("?currentStatus=Resolved&sortBy=recentlyUpdated"); expect(vi.mocked(getMyTickets).mock.calls.at(-1)![0]).toMatchObject({ page: 1, currentStatus: "Resolved", sortBy: "recentlyUpdated" });
});

it("identity changes invalidate old Detail history metadata", async () => {
 window.history.replaceState({}, "", "/tickets?currentStatus=Resolved&page=2"); render(<App/>); await screen.findAllByText("Owned result");
 fireEvent.click(screen.getAllByText("Owned result")[0]); await screen.findByRole("heading", { name: "Detail ticket-1" }); const oldState = window.history.state;
 vi.mocked(getCurrentUser).mockResolvedValue({ ...dashboardUser, id: "B" });
 act(() => { window.dispatchEvent(new Event("session-access-changed")); }); await screen.findByRole("heading", { name: "Detail ticket-1" });
 act(() => { window.history.replaceState(oldState, "", "/tickets/ticket-1"); window.dispatchEvent(new PopStateEvent("popstate")); });
 fireEvent.click(screen.getByRole("button", { name: "Back to My Tickets" })); await screen.findByRole("heading", { name: "My Tickets" }); expect(window.location.search).toBe("");
});
