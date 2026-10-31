import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import StaffTicketDetailScreen from "../../src/components/StaffTicketDetailScreen.js";

vi.mock("../../src/api.js", async () => ({ ...await vi.importActual<typeof api>("../../src/api.js"),
  getStaffTicket: vi.fn(), getEligibleOwners: vi.fn(), getActions: vi.fn(), updateStaffStatus: vi.fn(), createAction: vi.fn(), updateAction: vi.fn(),
}));
const user: api.AuthUser = { id: "staff", name: "Staff One", email: "staff@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false };
const detail: api.StaffTicketDetail = {
  id: "ticket", ticketNumber: "TKT-60", summary: "Network failure", description: "Protected description", status: "OPEN", requestedPriority: "HIGH", itPriority: "MEDIUM",
  category: { id: 1, name: "Network" }, relatedSystem: { id: "system", name: "Wi-Fi" }, requester: { id: "requester", name: "Alice", email: "alice@example.com" }, owner: null,
  ticketDate: "2026-10-13T00:00:00Z", createdAt: "2026-10-13T00:00:00Z", updatedAt: "2026-10-13T00:00:00Z", problemAppearsResolvedAt: null,
  attachments: [], publicComments: [], internalNotes: [], workflowVersion: 4,
  actionsTakenSummary: { totalItems: 1, pendingItems: 0, completedItems: 1, cancelledItems: 0, followUpRequiredItems: 0 }, resolutionEligibility: { eligible: true, reasonCodes: [] },
};
const setup = (currentUser = user) => render(<StaffTicketDetailScreen ticketId="ticket" currentUser={currentUser} onBack={vi.fn()}/>);
const choose = (status = "RESOLVED") => fireEvent.change(screen.getByLabelText("Next Status"), { target: { value: status } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
const refresh = () => fireEvent.click(screen.getByRole("button", { name: "Refresh Ticket detail" }));
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState({}, "", "/");
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.mocked(api.getStaffTicket).mockResolvedValue(detail);
  vi.mocked(api.getEligibleOwners).mockResolvedValue([{ id: user.id, name: user.name, role: "IT_STAFF" }]);
  vi.mocked(api.getActions).mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } });
  vi.mocked(api.updateStaffStatus).mockResolvedValue({ status: "RESOLVED", workflowVersion: 5 });
});
describe("Issue #60 workflow controls", () => {
  it.each([
    ["NEW", ["OPEN", "IN_PROGRESS", "CANCELLED"]], ["OPEN", ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]],
    ["IN_PROGRESS", ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]], ["WAITING_FOR_REQUESTER", ["IN_PROGRESS", "RESOLVED", "CANCELLED"]],
    ["RESOLVED", ["CLOSED", "REOPENED"]], ["CLOSED", ["REOPENED"]], ["REOPENED", ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"]], ["CANCELLED", ["REOPENED"]],
  ] as [api.StaffTicketStatus, string[]][])("offers only approved destinations from %s", async (status, destinations) => {
    vi.mocked(api.getStaffTicket).mockResolvedValue({ ...detail, status }); setup();
    const select = await screen.findByLabelText("Next Status");
    expect(Array.from(select.querySelectorAll("option")).map(o => o.value)).toEqual(["", ...destinations]);
    expect(select).toHaveAccessibleDescription(/Workflow version: 4/);
  });
  it("confirms ticket/current/destination and reviewed work; sends read version", async () => {
    setup(); await screen.findByText(/TKT-60: Network/); choose(); submit();
    await waitFor(() => expect(api.updateStaffStatus).toHaveBeenCalledWith("ticket", "RESOLVED", 4));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/TKT-60: change Open to Resolved.*reviewed the completed work/));
    expect(await screen.findByText(/Status updated/)).toHaveAttribute("role", "status");
  });
  it("cancelled confirmation sends no mutation", async () => {
    vi.mocked(window.confirm).mockReturnValue(false); setup(); await screen.findByLabelText("Next Status"); choose(); submit();
    expect(api.updateStaffStatus).not.toHaveBeenCalled();
  });
  it("renders all summary counts and multiple blockers with accessible Action review", async () => {
    vi.mocked(api.getStaffTicket).mockResolvedValue({ ...detail, actionsTakenSummary: { totalItems: 3, pendingItems: 1, completedItems: 1, cancelledItems: 1, followUpRequiredItems: 1 }, resolutionEligibility: { eligible: false, reasonCodes: ["PENDING_ACTIONS", "FOLLOW_UP_REQUIRED"] } });
    setup(); await screen.findByText(/3 total; 1 pending; 1 completed; 1 cancelled; 1 completed with follow-up/);
    expect(screen.getByText(/Pending Actions must/)).toBeInTheDocument(); expect(screen.getByText(/Completed Actions still require/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Review Actions Taken" })); expect(screen.getByRole("heading", { name: "Actions Taken" })).toHaveFocus();
    expect(screen.getByText(/Requester indication is advisory/)).toBeInTheDocument();
  });
  it("shows the explicit legacy close exception and closing confirmation", async () => {
    vi.mocked(api.getStaffTicket).mockResolvedValue({ ...detail, status: "RESOLVED", actionsTakenSummary: { totalItems: 0, pendingItems: 0, completedItems: 0, cancelledItems: 0, followUpRequiredItems: 0 }, resolutionEligibility: { eligible: false, reasonCodes: ["NO_COMPLETED_ACTIONS"] } });
    setup(); await screen.findByText(/legacy zero-Action resolved Ticket may close/); choose("CLOSED"); submit();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Closing requires the current resolution gate"));
    await screen.findByText(/Status updated/);
    await waitFor(() => expect(screen.getByLabelText("Next Status")).toBeEnabled());
  });
  it("prevents duplicate submission synchronously and while save is pending", async () => {
    const save = deferred<{ status: api.StaffTicketStatus; workflowVersion: number }>(); vi.mocked(api.updateStaffStatus).mockReturnValue(save.promise);
    setup(); await screen.findByLabelText("Next Status"); choose(); submit(); submit();
    expect(api.updateStaffStatus).toHaveBeenCalledTimes(1); expect(screen.getByLabelText("Next Status")).toBeDisabled();
    await act(async () => save.resolve({ status: "RESOLVED", workflowVersion: 5 }));
  });
  it("blocks stale resubmit, preserves unrelated and mounted Action drafts, then requires explicit fresh choice", async () => {
    vi.mocked(api.updateStaffStatus).mockRejectedValueOnce(new api.ApiError("CONFLICT", "Changed", 409));
    setup(); await screen.findByLabelText("Next Status");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Action" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    const actionDraft = screen.getByLabelText("Action Description", { exact: false }); fireEvent.change(actionDraft, { target: { value: "Retained Action draft" } });
    fireEvent.change(screen.getByLabelText("Public Comment"), { target: { value: "Retained comment" } });
    choose(); submit(); await screen.findByText(/Ticket state changed/);
    expect(screen.getByLabelText("Next Status")).toBeDisabled(); submit(); expect(api.updateStaffStatus).toHaveBeenCalledTimes(1);
    vi.mocked(api.getStaffTicket).mockResolvedValue({ ...detail, status: "WAITING_FOR_REQUESTER", workflowVersion: 8 }); refresh();
    await waitFor(() => expect(screen.getByLabelText("Next Status")).toBeEnabled());
    expect(screen.getByLabelText("Next Status")).toHaveValue(""); expect(screen.getByRole("button", { name: "Update Status" })).toBeDisabled();
    expect(screen.getByLabelText("Action Description", { exact: false })).toBe(actionDraft); expect(actionDraft).toHaveValue("Retained Action draft"); expect(screen.getByLabelText("Public Comment")).toHaveValue("Retained comment");
    choose(); submit(); await waitFor(() => expect(api.updateStaffStatus).toHaveBeenLastCalledWith("ticket", "RESOLVED", 8));
  });
  it("keeps workflow paused after failed conflict refresh", async () => {
    vi.mocked(api.updateStaffStatus).mockRejectedValueOnce(new api.ApiError("CONFLICT", "Changed", 409)); setup(); await screen.findByLabelText("Next Status"); choose(); submit(); await screen.findByText(/Ticket state changed/);
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(new Error("Unavailable")); refresh(); await screen.findByText(/Ticket refresh failed/);
    expect(screen.getByLabelText("Next Status")).toBeDisabled(); expect(api.updateStaffStatus).toHaveBeenCalledTimes(1);
  });
  it("distinguishes gate failure from stale conflict and displays server reason codes", async () => {
    vi.mocked(api.updateStaffStatus).mockRejectedValueOnce(new api.ApiError("RESOLUTION_REQUIREMENTS_NOT_MET", "Review", 409, undefined, {}, ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS"]));
    setup(); await screen.findByLabelText("Next Status"); choose(); submit(); await screen.findByText(/Review Actions Taken and refresh eligibility/);
    expect(screen.getByText(/At least one completed Action/)).toBeInTheDocument(); expect(screen.getByText(/Pending Actions must/)).toBeInTheDocument();
    expect(screen.queryByText(/Ticket state changed/)).not.toBeInTheDocument(); expect(screen.getByLabelText("Next Status")).toBeEnabled();
  });
  it("retains confirmed status-save feedback and Action retry identity after refresh failure; retry only GET", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new TypeError("Response lost")); setup(); await screen.findByLabelText("Next Status");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Action" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Action Description", { exact: false }), { target: { value: "Uncertain work" } });
    fireEvent.change(screen.getByLabelText("Result", { exact: false }), { target: { value: "Pending verification" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" })); await screen.findByText(/Check your connection/);
    const original = vi.mocked(api.createAction).mock.calls[0][1]; const draft = screen.getByLabelText("Result", { exact: false });
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(new Error("Refresh unavailable")); choose("CANCELLED"); submit();
    await screen.findByText(/Ticket refresh failed/); expect(screen.getByText(/Status updated/)).toHaveAttribute("role", "status"); expect(screen.getByLabelText("Next Status")).toBeDisabled(); expect(screen.getByLabelText("Result", { exact: false })).toBe(draft);
    vi.mocked(api.getStaffTicket).mockResolvedValue({ ...detail, status: "CANCELLED", workflowVersion: 5 }); refresh(); await waitFor(() => expect(screen.getByLabelText("Next Status")).toBeEnabled());
    expect(api.updateStaffStatus).toHaveBeenCalledTimes(1);
    vi.mocked(api.createAction).mockResolvedValue({ data: {} as api.ActionTaken, meta: { workflowVersion: 5 }, replay: true });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" })); await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.createAction).mock.calls[1][1]).toEqual(original);
  });
  it.each([401, 403, 404])("clears protected parent and Action draft when mutation loses access (%s)", async status => {
    vi.mocked(api.updateStaffStatus).mockRejectedValueOnce(new api.ApiError("FORBIDDEN", "No access", status));
    setup(); await screen.findByLabelText("Next Status"); choose(); submit(); await screen.findByText(/session or access changed/);
    expect(screen.queryByText("Protected description")).not.toBeInTheDocument(); expect(screen.queryByRole("heading", { name: "Actions Taken" })).not.toBeInTheDocument();
  });
  it("ignores a late status response after identity changes", async () => {
    const save = deferred<{ status: api.StaffTicketStatus; workflowVersion: number }>(); vi.mocked(api.updateStaffStatus).mockReturnValue(save.promise);
    const view = setup(); await screen.findByLabelText("Next Status"); choose(); submit();
    view.rerender(<StaffTicketDetailScreen ticketId="other-ticket" currentUser={{ ...user, id: "other-staff" }} onBack={vi.fn()}/>);
    await act(async () => save.resolve({ status: "RESOLVED", workflowVersion: 5 }));
    expect(screen.queryByText(/Status updated/)).not.toBeInTheDocument(); expect(api.getStaffTicket).toHaveBeenCalledTimes(2);
  });
  it("ignores an older parent refresh and disables status during the latest refresh", async () => {
    setup(); await screen.findByLabelText("Next Status");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Action" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Action Description", { exact: false }), { target: { value: "Concurrent saved work" } });
    fireEvent.change(screen.getByLabelText("Result", { exact: false }), { target: { value: "Verified" } });
    const old = deferred<api.StaffTicketDetail>(), fresh = deferred<api.StaffTicketDetail>();
    vi.mocked(api.getStaffTicket).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    vi.mocked(api.createAction).mockResolvedValue({ data: {} as api.ActionTaken, meta: { workflowVersion: 9 }, replay: false });
    refresh(); expect(screen.getByLabelText("Next Status")).toBeDisabled();
    // A confirmed child write requests its own newer parent GET while the manual
    // refresh is still outstanding. The older response must not replace it.
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await waitFor(() => expect(api.getStaffTicket).toHaveBeenCalledTimes(3));
    await act(async () => fresh.resolve({ ...detail, workflowVersion: 9 }));
    await act(async () => old.resolve({ ...detail, workflowVersion: 6 }));
    expect(screen.getByText("Workflow version: 9")).toBeInTheDocument();
    expect(api.updateStaffStatus).not.toHaveBeenCalled();
  });
  it("refreshes eligibility after completing an Action without remounting the parent", async () => {
    const child: api.ActionTaken = { id: "action", ticketId: detail.id, actionDescription: "Pending work", actionResult: "Awaiting verification", followUpRequired: false, followUpNote: null, attachmentNotes: null, status: "PENDING", version: 1, createdAt: detail.createdAt, updatedAt: detail.updatedAt, actionDateTime: detail.createdAt, performedBy: user, assignee: user };
    vi.mocked(api.getStaffTicket).mockResolvedValueOnce({ ...detail, workflowVersion: 1, resolutionEligibility: { eligible: false, reasonCodes: ["NO_COMPLETED_ACTIONS", "PENDING_ACTIONS"] } }).mockResolvedValue(detail);
    vi.mocked(api.getActions).mockResolvedValue({ data: [child], meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } });
    vi.mocked(api.updateAction).mockResolvedValue({ data: { ...child, status: "COMPLETED" }, meta: { workflowVersion: 4 }, replay: false });
    setup(); await screen.findByText(/At least one completed Action/); fireEvent.click(await screen.findByRole("button", { name: "Edit Action: Pending work" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete action" }));
    await screen.findByText("Resolution requirements met. Staff review is required."); expect(screen.getByText("Workflow version: 4")).toBeInTheDocument();
  });
  it("keeps the mounted uncertain Action draft and original retry request through an unresolved parent refresh", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new TypeError("Response lost"));
    setup(); await screen.findByLabelText("Next Status");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Action" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
    fireEvent.change(screen.getByLabelText("Action Description", { exact: false }), { target: { value: "Retained uncertain work" } });
    fireEvent.change(screen.getByLabelText("Result", { exact: false }), { target: { value: "Pending verification" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" })); await screen.findByText(/Check your connection/);
    const draft = screen.getByLabelText("Result", { exact: false });
    const original = vi.mocked(api.createAction).mock.calls[0][1];
    const reading = deferred<api.StaffTicketDetail>(); vi.mocked(api.getStaffTicket).mockReturnValueOnce(reading.promise);
    refresh();
    expect(screen.getByLabelText("Next Status")).toBeDisabled();
    for (const label of ["IT Priority", "Assign or reassign owner", "Public Comment", "Internal Note"]) expect(screen.getByLabelText(label)).toBeDisabled();
    expect(screen.getByLabelText("Result", { exact: false })).toBe(draft); expect(draft).toHaveValue("Pending verification");
    expect(api.createAction).toHaveBeenCalledTimes(1);
    await act(async () => reading.resolve(detail));
    expect(screen.getByLabelText("Next Status")).toBeEnabled(); expect(screen.getByLabelText("Result", { exact: false })).toBe(draft);
    vi.mocked(api.createAction).mockResolvedValue({ data: {} as api.ActionTaken, meta: { workflowVersion: 4 }, replay: true });
    fireEvent.click(screen.getByRole("button", { name: "Save Action" }));
    await screen.findByText("Action saved.");
    await waitFor(() => expect(screen.getByLabelText("Next Status")).toBeEnabled());
    expect(api.createAction).toHaveBeenCalledTimes(2); expect(vi.mocked(api.createAction).mock.calls[1][1]).toEqual(original);
  });
  it("never shows formal controls to Requester/inactive/password-change users", () => {
    const view = setup({ ...user, role: "REQUESTER" }); expect(screen.queryByLabelText("Next Status")).not.toBeInTheDocument(); expect(api.getStaffTicket).not.toHaveBeenCalled();
    for (const change of [{ isActive: false }, { mustChangePassword: true }]) { view.rerender(<StaffTicketDetailScreen ticketId="ticket" currentUser={{ ...user, ...change }} onBack={vi.fn()}/>); expect(screen.queryByLabelText("Next Status")).not.toBeInTheDocument(); }
  });
});
