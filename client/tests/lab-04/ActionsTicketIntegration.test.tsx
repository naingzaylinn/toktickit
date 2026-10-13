import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import StaffTicketDetailScreen from "../../src/components/StaffTicketDetailScreen.js";

vi.mock("../../src/api.js", async () => ({
  ...await vi.importActual<typeof api>("../../src/api.js"),
  getStaffTicket: vi.fn(), getEligibleOwners: vi.fn(), getActions: vi.fn(),
  createAction: vi.fn(), updateAction: vi.fn(), postComment: vi.fn(),
}));
const staff: api.AuthUser = { id: "10000000-0000-4000-8000-000000000001", name: "Staff One", email: "staff1@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false };
const ticket: api.StaffTicketDetail = {
  id: "30000000-0000-4000-8000-000000000001", ticketNumber: "TKT-59", summary: "Connection issue", description: "Cannot connect",
  category: { id: 1, name: "Network" }, requester: { id: "requester", name: "Alice", email: "alice@example.com" },
  requestedPriority: "HIGH", itPriority: "MEDIUM", status: "OPEN", owner: null,
  relatedSystem: { id: "system", name: "Network" }, ticketDate: "2026-10-12T00:00:00.000Z",
  createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z", workflowVersion: 0, actionsTakenSummary: { totalItems: 0, pendingItems: 0, completedItems: 0, cancelledItems: 0, followUpRequiredItems: 0 }, resolutionEligibility: { eligible: false, reasonCodes: ["NO_COMPLETED_ACTIONS"] }, problemAppearsResolvedAt: null,
  attachments: [], publicComments: [], internalNotes: [{ id: "note", ticketId: "30000000-0000-4000-8000-000000000001", content: "Protected internal observation", author: { id: staff.id, name: staff.name, role: staff.role }, createdAt: "2026-10-12T00:00:00.000Z" }],
};
const action: api.ActionTaken = {
  id: "20000000-0000-4000-8000-000000000001", ticketId: ticket.id, actionDescription: "Existing shared Action", actionResult: "Pending verification",
  followUpRequired: false, followUpNote: null, attachmentNotes: null,
  performedBy: { id: staff.id, name: staff.name, role: staff.role }, assignee: { id: staff.id, name: staff.name, role: staff.role, isActive: true },
  status: "PENDING", version: 3, actionDateTime: "2026-10-12T00:00:00.000Z", createdAt: "2026-10-12T00:00:00.000Z", updatedAt: "2026-10-12T00:00:00.000Z",
};
const history = (data: api.ActionTaken[] = []): api.ActionHistory => ({ data, meta: { page: 1, pageSize: 20, totalItems: data.length, totalPages: data.length ? 1 : 0 } });
const mutation = (data = action): api.ActionMutation => ({ data, meta: { workflowVersion: 4 }, replay: false });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
const setup = () => render(<StaffTicketDetailScreen ticketId={ticket.id} currentUser={staff} onBack={vi.fn()}/>);
const newDraft = async () => {
  await waitFor(() => expect(screen.getByRole("button", { name: "Add Action" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Add Action" }));
  change("Action Description", "  Retained work description  "); change("Result", "  Awaiting requester test  ");
};
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState({}, "", "/");
  vi.mocked(api.getStaffTicket).mockResolvedValue(ticket);
  vi.mocked(api.getEligibleOwners).mockResolvedValue([{ id: staff.id, name: staff.name, role: staff.role as "IT_STAFF" }]);
  vi.mocked(api.getActions).mockResolvedValue(history());
  vi.mocked(api.createAction).mockResolvedValue(mutation());
  vi.mocked(api.updateAction).mockResolvedValue(mutation());
  vi.mocked(api.postComment).mockResolvedValue({} as api.PublicComment);
});
describe("Actions and parent Ticket Detail recovery", () => {
  it("retains an uncertain create identity through a failed parent refresh and exact replay creates one record", async () => {
    const records = new Map<string, api.ActionTaken>();
    vi.mocked(api.createAction).mockImplementation(async (_id, input) => {
      const committed = records.get(input.clientRequestId);
      if (committed) return { ...mutation(committed), replay: true };
      records.set(input.clientRequestId, { ...action, version: 1, actionDescription: input.actionDescription });
      throw new TypeError("Response lost after commit");
    });
    setup(); await newDraft(); const input = screen.getByLabelText("Result", { exact: false });
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/Check your connection/);
    const original = { ...vi.mocked(api.createAction).mock.calls[0][1] };
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(new TypeError("Refresh offline"));
    // Exercise an existing parent mutation's refresh, rather than an isolated child callback.
    change("Public Comment", "Unrelated reply"); fireEvent.click(screen.getByText("Post Public Comment"));
    await screen.findByText(/Ticket refresh failed/);
    expect(screen.getByLabelText("Result", { exact: false })).toBe(input);
    expect(input).toHaveValue("  Awaiting requester test  ");
    expect(screen.getByText("Protected internal observation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText(/Ticket refresh failed/)).not.toBeInTheDocument());
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(vi.mocked(api.createAction).mock.calls[1][1]).toEqual(original);
    expect(records.size).toBe(1); expect(api.createAction).toHaveBeenCalledTimes(2);
  });
  it("keeps confirmed Action-save feedback when the following parent refresh fails", async () => {
    setup(); await newDraft();
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(new api.ApiError("INTERNAL_SERVER_ERROR", "Unavailable", 500));
    fireEvent.click(screen.getByText("Save Action"));
    await screen.findByText("Saved; unable to refresh. Retry loading the confirmed records.");
    expect(screen.getByRole("heading", { name: "Actions Taken" })).toBeInTheDocument();
    expect(screen.getByText("Protected internal observation")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByText(/Ticket refresh failed/)).not.toBeInTheDocument());
    expect(api.createAction).toHaveBeenCalledOnce();
  });
  it.each(["network", "server"] as const)("preserves the mounted editor and expected version after a %s refresh failure", async kind => {
    vi.mocked(api.getActions).mockResolvedValue(history([action]));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); change("Result", "Versioned draft");
    const editor = screen.getByLabelText("Result", { exact: false });
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(kind === "network" ? new TypeError("Offline") : new api.ApiError("INTERNAL_SERVER_ERROR", "Unavailable", 500));
    fireEvent.click(screen.getByText("Refresh Ticket detail")); await screen.findByText(/Ticket refresh failed/);
    expect(screen.getByLabelText("Result", { exact: false })).toBe(editor); expect(editor).toHaveValue("Versioned draft");
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(api.updateAction).toHaveBeenCalledWith(ticket.id, action.id, expect.objectContaining({ expectedVersion: 3, actionResult: "Versioned draft" }));
  });
  it("treats initial failure as unavailable rather than displaying a cached Ticket", async () => {
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(new TypeError("Initial load offline"));
    setup(); await screen.findByText("Unable to load ticket detail. Please retry.");
    expect(screen.queryByRole("heading", { name: "Actions Taken" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Retry")); await screen.findByText("Protected internal observation");
  });
  it.each([401, 403, 404])("clears protected Ticket and Action state when refresh returns %s", async status => {
    vi.mocked(api.getActions).mockResolvedValue(history([action])); setup(); await newDraft();
    vi.mocked(api.getStaffTicket).mockRejectedValueOnce(new api.ApiError(status === 401 ? "AUTHENTICATION_REQUIRED" : status === 403 ? "FORBIDDEN" : "TICKET_NOT_FOUND", "Access lost", status));
    fireEvent.click(screen.getByText("Refresh Ticket detail"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Actions Taken" })).not.toBeInTheDocument());
    expect(screen.queryByText(action.actionDescription)).not.toBeInTheDocument();
    expect(screen.queryByText("Protected internal observation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Action Description", { exact: false })).not.toBeInTheDocument();
  });
  it.each([[401, "AUTHENTICATION_REQUIRED"], [403, "FORBIDDEN"], [403, "PASSWORD_CHANGE_REQUIRED"]] as const)("clears the entire parent when an Action write returns %s %s", async (status, code) => {
    setup(); await newDraft();
    let finishRefresh!: (detail: api.StaffTicketDetail) => void;
    vi.mocked(api.getStaffTicket).mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
    fireEvent.click(screen.getByText("Refresh Ticket detail"));
    vi.mocked(api.createAction).mockRejectedValueOnce(new api.ApiError(code, "Access changed", status));
    fireEvent.click(screen.getByText("Save Action"));
    await screen.findByText(/Your session or access changed/);
    expect(screen.queryByText("Protected internal observation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Actions Taken" })).not.toBeInTheDocument();
    await act(async () => finishRefresh(ticket));
    expect(screen.queryByText("Protected internal observation")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Action Description", { exact: false })).not.toBeInTheDocument();
  });
  it.each(["ticket", "user"] as const)("removes previous drafts/history immediately on %s switch and ignores old refresh responses", async kind => {
    vi.mocked(api.getActions).mockResolvedValue(history([action]));
    const view = setup(); await newDraft();
    let finish!: (detail: api.StaffTicketDetail) => void;
    vi.mocked(api.getStaffTicket).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByText("Refresh Ticket detail"));
    const nextTicket = kind === "ticket" ? { ...ticket, id: "30000000-0000-4000-8000-000000000002", summary: "New Ticket", internalNotes: [] } : { ...ticket, summary: "New user's detail", internalNotes: [] };
    const nextUser = kind === "user" ? { ...staff, id: "10000000-0000-4000-8000-000000000002", name: "Staff Two" } : staff;
    vi.mocked(api.getStaffTicket).mockResolvedValueOnce(nextTicket); vi.mocked(api.getActions).mockResolvedValue(history());
    view.rerender(<StaffTicketDetailScreen ticketId={nextTicket.id} currentUser={nextUser} onBack={vi.fn()}/>);
    expect(screen.queryByLabelText("Action Description", { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(action.actionDescription)).not.toBeInTheDocument();
    await screen.findByText(new RegExp(nextTicket.summary)); await act(async () => finish(ticket));
    expect(screen.queryByText("Protected internal observation")).not.toBeInTheDocument();
    expect(screen.queryByText(action.actionDescription)).not.toBeInTheDocument();
  });
  it("clears the staff view when the current user's role becomes Requester", async () => {
    const view = setup(); await newDraft();
    view.rerender(<StaffTicketDetailScreen ticketId={ticket.id} currentUser={{ ...staff, role: "REQUESTER" }} onBack={vi.fn()}/>);
    expect(screen.getByText(/unavailable for your session or role/)).toBeInTheDocument();
    expect(screen.queryByText("Protected internal observation")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Actions Taken" })).not.toBeInTheDocument();
  });
  it("explicitly refreshes a workflow conflict, updates Ticket controls, preserves the draft and does not retry PATCH", async () => {
    vi.mocked(api.getActions).mockResolvedValue(history([action]));
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ApiError("TICKET_WORKFLOW_CONFLICT", "Parent changed", 409));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); change("Result", "Uncommitted correction");
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/requires the Ticket to be reopened/);
    expect(screen.getByText("Save Action")).toBeDisabled();
    vi.mocked(api.getStaffTicket).mockResolvedValueOnce({ ...ticket, status: "CANCELLED" });
    fireEvent.click(screen.getByText("Refresh Ticket and Actions for review"));
    await screen.findByText(/Current Ticket status: CANCELLED/);
    expect(screen.getByLabelText("Next Status")).toHaveTextContent("Reopened");
    expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("Uncommitted correction");
    expect(api.updateAction).toHaveBeenCalledOnce();
    expect(api.getActions).toHaveBeenCalledTimes(2);
  });
});
