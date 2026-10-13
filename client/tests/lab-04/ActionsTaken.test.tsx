import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../src/api.js";
import ActionsTaken from "../../src/components/ActionsTaken.js";

vi.mock("../../src/api.js", async () => ({ ...await vi.importActual<typeof api>("../../src/api.js"), getActions: vi.fn(), getEligibleOwners: vi.fn(), createAction: vi.fn(), updateAction: vi.fn() }));
const staff: api.AuthUser = { id: "10000000-0000-4000-8000-000000000001", name: "Staff", email: "staff@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false };
const other: api.EligibleOwner = { id: "10000000-0000-4000-8000-000000000002", name: "Administrator", role: "ADMINISTRATOR" };
const action: api.ActionTaken = { id: "20000000-0000-4000-8000-000000000001", ticketId: "30000000-0000-4000-8000-000000000001", actionDateTime: "2026-10-12T01:00:00.000Z", createdAt: "2026-10-12T01:00:00.000Z", updatedAt: "2026-10-12T01:00:00.000Z", actionDescription: "Investigated connection", actionResult: "Awaiting verification", performedBy: { id: staff.id, name: "Original recorder", role: staff.role }, assignee: { id: staff.id, name: staff.name, role: staff.role, isActive: true }, status: "PENDING", followUpRequired: false, followUpNote: null, attachmentNotes: "Screenshot.png", version: 1 };
const page = (data: api.ActionTaken[] = [action], n = 1, total = data.length): api.ActionHistory => ({ data, meta: { page: n, pageSize: 20, totalItems: total, totalPages: Math.ceil(total / 20) } });
const mutation = (data = action): api.ActionMutation => ({ data, meta: { workflowVersion: 2 }, replay: false });
const setup = (status = "OPEN") => render(<ActionsTaken ticketId={action.ticketId} ticketNumber="TKT-1" currentUser={staff} ticketStatus={status}/>);
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
const openNew = async () => { fireEvent.click(await screen.findByRole("button", { name: "Add Action" })); };
const fillNew = () => { change("Action Description", "  Checked network  "); change("Result", "  Awaiting test  "); };
const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
beforeEach(() => {
  vi.resetAllMocks(); window.history.replaceState({}, "", "/");
  vi.mocked(api.getActions).mockResolvedValue(page());
  vi.mocked(api.getEligibleOwners).mockResolvedValue([{ id: staff.id, name: staff.name, role: "IT_STAFF" }, other]);
  vi.mocked(api.createAction).mockResolvedValue(mutation());
  vi.mocked(api.updateAction).mockResolvedValue(mutation());
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(() => vi.restoreAllMocks());
describe("Actions Taken", () => {
  it("loads all shared fields and distinct identities, with semantic dates", async () => {
    setup(); expect(screen.getByText("Loading Actions Taken...")).toHaveAttribute("role", "status");
    expect(await screen.findByText(action.actionDescription)).toBeInTheDocument();
    fireEvent.click(screen.getByText("View Action details"));
    expect(screen.getByText(action.actionResult)).toBeInTheDocument();
    expect(screen.getByText("Original recorder")).toBeInTheDocument();
    expect(screen.getByText("Screenshot.png")).toBeInTheDocument();
    expect(document.querySelector("time")).toHaveAttribute("datetime", action.createdAt);
    expect(api.getActions).toHaveBeenCalledWith(action.ticketId, true, { page: 1, pageSize: 20 });
  });
  it("shows empty history and eligible assignees defaulting to current staff", async () => {
    vi.mocked(api.getActions).mockResolvedValue(page([])); setup();
    expect(await screen.findByText("No actions recorded for this ticket.")).toBeInTheDocument();
    await openNew(); const select = screen.getByLabelText("Action Assignee", { exact: false });
    expect(select).toHaveValue(staff.id); expect(within(select).getByText("Administrator (ADMINISTRATOR)")).toBeInTheDocument();
  });
  it.each(["RESOLVED", "CLOSED", "CANCELLED"])("disables Add Action on %s with reopen guidance", async status => {
    setup(status); expect(await screen.findByRole("button", { name: "Add Action" })).toBeDisabled();
    expect(screen.getByText(/Reopen this Ticket/)).toBeInTheDocument();
  });
  it("validates required, trimmed maximum, conditional and NUL fields without losing input", async () => {
    setup(); await openNew(); fireEvent.click(screen.getByText("Save Action"));
    await waitFor(() => expect(screen.getByLabelText("Action Description", { exact: false })).toHaveAttribute("aria-invalid", "true"));
    fillNew(); change("Attachment Notes", "x".repeat(2001)); fireEvent.click(screen.getByLabelText("Follow-up Required?"));
    fireEvent.click(screen.getByText("Save Action"));
    expect(screen.getByLabelText("Follow-up Note", { exact: false })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Attachment Notes")).toHaveValue("x".repeat(2001));
    change("Attachment Notes", "\u0000"); fireEvent.click(screen.getByText("Save Action"));
    expect(await screen.findByText("NUL characters are not permitted.")).toBeInTheDocument();
    expect(api.createAction).not.toHaveBeenCalled();
  });
  it("creates normalized content without performer or initial state and refreshes", async () => {
    setup(); await openNew(); fillNew(); fireEvent.click(screen.getByText("Save Action"));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledOnce());
    const input = vi.mocked(api.createAction).mock.calls[0][1];
    expect(input).toEqual({ actionDescription: "Checked network", actionResult: "Awaiting test", followUpRequired: false, followUpNote: null, attachmentNotes: null, assigneeId: staff.id, clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(await screen.findByText("Action saved.")).toBeInTheDocument(); expect(api.getActions).toHaveBeenCalledTimes(2);
  });
  it("reuses its key after network failure and handles successful replay", async () => {
    vi.mocked(api.createAction).mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce({ ...mutation(), replay: true });
    setup(); await openNew(); fillNew(); fireEvent.click(screen.getByText("Save Action"));
    await screen.findByText(/Check your connection/); expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("  Awaiting test  ");
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(vi.mocked(api.createAction).mock.calls[0][1]).toEqual(vi.mocked(api.createAction).mock.calls[1][1]);
  });
  it("uses a new key only after explicit confirmation for changed create intent", async () => {
    vi.mocked(api.createAction).mockRejectedValue(new TypeError("network"));
    setup(); await openNew(); fillNew(); fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/Check your connection/);
    change("Result", "Changed intent"); vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getByText("Save Action")); await waitFor(() => expect(window.confirm).toHaveBeenCalled()); expect(api.createAction).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Save Action")); await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.createAction).mock.calls[0][1].clientRequestId).not.toEqual(vi.mocked(api.createAction).mock.calls[1][1].clientRequestId);
  });
  it("prevents duplicate submission while saving", async () => {
    let finish!: (v: api.ActionMutation) => void;
    vi.mocked(api.createAction).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    setup(); await openNew(); fillNew(); fireEvent.click(screen.getByText("Save Action"));
    fireEvent.click(screen.getByText("Saving...")); expect(api.createAction).toHaveBeenCalledOnce(); expect(screen.getByText("Saving...")).toBeDisabled();
    finish(mutation()); await screen.findByText("Action saved.");
  });
  it("maps backend validation errors to accessible fields and retains input", async () => {
    vi.mocked(api.createAction).mockRejectedValue(new api.ApiError("VALIDATION_ERROR", "Invalid fields.", 400, undefined, { actionDescription: "Server description error" }));
    setup(); await openNew(); fillNew(); fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Server description error");
    expect(screen.getByLabelText("Action Description", { exact: false })).toHaveAccessibleDescription("Server description error");
    expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("  Awaiting test  ");
  });
  it("edits and reassigns with the current expectedVersion", async () => {
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); change("Action Assignee", other.id); change("Result", "Verified");
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(api.updateAction).toHaveBeenCalledWith(action.ticketId, action.id, expect.objectContaining({ expectedVersion: 1, assigneeId: other.id, actionResult: "Verified" }));
  });
  it("completion confirms current operator and never sends performer identity", async () => {
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ }));
    vi.mocked(window.confirm).mockReturnValueOnce(false); fireEvent.click(screen.getByText("Complete action")); expect(api.updateAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Complete action")); await screen.findByText("Action completed.");
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Completing as Staff"));
    expect(api.updateAction).toHaveBeenCalledWith(action.ticketId, action.id, expect.objectContaining({ status: "COMPLETED", expectedVersion: 1 }));
    expect(vi.mocked(api.updateAction).mock.calls[0][2]).not.toHaveProperty("performedById");
  });
  it("requires a newly entered cancellation reason and permits inactive-assignee cancellation", async () => {
    vi.mocked(api.getActions).mockResolvedValue(page([{ ...action, assignee: { ...action.assignee, isActive: false } }]));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ }));
    expect(screen.getByText("Complete action")).toBeDisabled(); fireEvent.click(screen.getByText("Cancel action"));
    fireEvent.click(screen.getByText("Cancel action")); expect(api.updateAction).not.toHaveBeenCalled();
    change("Result", "Duplicate work"); fireEvent.click(screen.getByText("Cancel action")); await screen.findByText("Action cancelled.");
    expect(api.updateAction).toHaveBeenCalledWith(action.ticketId, action.id, expect.objectContaining({ status: "CANCELLED", actionResult: "Duplicate work" }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Cancelling as Staff"));
  });
  it.each(["COMPLETED", "CANCELLED"] as const)("allows only content correction for %s", async status => {
    vi.mocked(api.getActions).mockResolvedValue(page([{ ...action, status }])); setup();
    fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ }));
    expect(screen.queryByText("Complete action")).not.toBeInTheDocument(); expect(screen.queryByText("Cancel action")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Action Assignee/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    const input = vi.mocked(api.updateAction).mock.calls[0][2]; expect(input).not.toHaveProperty("assigneeId"); expect(input).not.toHaveProperty("status");
  });
  it("requires a different explanation when clearing completed follow-up", async () => {
    vi.mocked(api.getActions).mockResolvedValue(page([{ ...action, status: "COMPLETED", followUpRequired: true, followUpNote: "Retest plan" }]));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); fireEvent.click(screen.getByLabelText("Follow-up Required?"));
    fireEvent.click(screen.getByText("Save Action")); expect(api.updateAction).not.toHaveBeenCalled();
    change("Follow-up Note", "Requester retested successfully"); fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(api.updateAction).toHaveBeenCalledWith(action.ticketId, action.id, expect.objectContaining({ followUpRequired: false, followUpNote: "Requester retested successfully" }));
  });
  it("preserves stale drafts and requires review plus explicit retry using refreshed version", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ApiError("CONFLICT", "Stale", 409)).mockResolvedValueOnce(mutation());
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); change("Result", "My unsaved outcome");
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/Your draft is preserved/);
    expect(screen.getByText("Save Action")).toBeDisabled(); expect(api.updateAction).toHaveBeenCalledOnce();
    vi.mocked(api.getActions).mockResolvedValue(page([{ ...action, actionResult: "Other staff outcome", version: 2 }]));
    fireEvent.click(screen.getByText("Reload for review")); await screen.findByText(/Current server version 2/);
    expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("My unsaved outcome");
    fireEvent.click(screen.getByText("Use current version for explicit retry")); expect(api.updateAction).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(vi.mocked(api.updateAction).mock.calls[1][2]).toMatchObject({ expectedVersion: 2, actionResult: "My unsaved outcome" });
  });
  it("reports save success separately from refresh failure and retries only GET", async () => {
    setup(); await openNew(); fillNew(); vi.mocked(api.getActions).mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/Saved; unable to refresh/);
    vi.mocked(api.getActions).mockResolvedValue(page()); fireEvent.click(screen.getByRole("button", { name: /Retry: Actions/ }));
    await waitFor(() => expect(api.getActions).toHaveBeenCalledTimes(3)); expect(api.createAction).toHaveBeenCalledOnce();
  });
  it("loads bounded next pages and permitted page sizes", async () => {
    vi.mocked(api.getActions).mockResolvedValue(page([action], 1, 21)); setup(); await screen.findByText(action.actionDescription);
    fireEvent.click(screen.getByText("Next Actions")); await waitFor(() => expect(api.getActions).toHaveBeenLastCalledWith(action.ticketId, true, { page: 2, pageSize: 20 }));
    fireEvent.change(screen.getByLabelText("Actions per page"), { target: { value: "50" } });
    await waitFor(() => expect(api.getActions).toHaveBeenLastCalledWith(action.ticketId, true, { page: 1, pageSize: 50 }));
  });
  it("uses the ownership endpoint for read-only requester history with every state", async () => {
    vi.mocked(api.getActions).mockResolvedValue(page([action, { ...action, id: "completed", status: "COMPLETED" }, { ...action, id: "cancelled", status: "CANCELLED" }]));
    render(<ActionsTaken ticketId={action.ticketId}/>); await screen.findAllByText(action.actionDescription);
    expect(api.getActions).toHaveBeenCalledWith(action.ticketId, false, { page: 1, pageSize: 20 });
    for (const name of [/Add Action/, /Edit Action/, /Complete action/, /Cancel action/]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument(); expect(screen.getByText("CANCELLED")).toBeInTheDocument(); expect(api.getEligibleOwners).not.toHaveBeenCalled();
  });
  it.each([401, 403])("clears protected history and drafts on %s", async status => {
    setup(); await openNew(); fillNew();
    vi.mocked(api.createAction).mockRejectedValueOnce(new api.ApiError("FORBIDDEN", "Denied", status));
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/unavailable for your session or role/);
    expect(screen.queryByText(action.actionDescription)).not.toBeInTheDocument(); expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("handles ownership 404 safely without turning it into empty history", async () => {
    vi.mocked(api.getActions).mockRejectedValue(new api.ApiError("TICKET_NOT_FOUND", "Missing", 404));
    render(<ActionsTaken ticketId={action.ticketId}/>); await screen.findByText("Ticket or Action not found or unavailable.");
    expect(screen.queryByText("No actions recorded for this ticket.")).not.toBeInTheDocument();
  });
  it("focuses a bounded staff action deep link", async () => {
    window.history.replaceState({}, "", "/#action-" + action.id); setup(); await screen.findByText(action.actionDescription);
    expect(api.getActions).toHaveBeenCalledWith(action.ticketId, true, { pageSize: 20, focusActionId: action.id });
    expect(document.getElementById("action-" + action.id)).toHaveFocus();
  });
  it("ignores superseded history after unmount", async () => {
    let finish!: (v: api.ActionHistory) => void; vi.mocked(api.getActions).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = setup(); view.unmount(); render(<ActionsTaken ticketId="another-ticket"/>);
    await screen.findByText(action.actionDescription); finish(page([{ ...action, actionDescription: "Previous user record" }]));
    await waitFor(() => expect(screen.queryByText("Previous user record")).not.toBeInTheDocument());
  });
  it("explains why creation is disabled when no eligible staff exist", async () => {
    vi.mocked(api.getEligibleOwners).mockResolvedValue([]); setup(); await openNew();
    expect(screen.getByText(/No eligible active IT Staff/)).toBeInTheDocument();
    expect(screen.getByText("Save Action")).toBeDisabled();
  });
  it("links inactive-assignee backend errors without losing the draft", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ApiError("INVALID_ACTION_ASSIGNEE", "Choose eligible staff", 400, undefined, { assigneeId: "Assignee became inactive" }));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); change("Result", "Verified outcome");
    fireEvent.click(screen.getByText("Complete action")); await screen.findByText("Assignee became inactive");
    expect(screen.getByLabelText("Action Assignee", { exact: false })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("Verified outcome");
  });
  it("offers reopen guidance for the parent guard while retaining correction input", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ApiError("TICKET_WORKFLOW_CONFLICT", "Reopen", 409));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); change("Result", "Correction draft");
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/requires the Ticket to be reopened/);
    expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("Correction draft");
  });
  it("adopts terminal restrictions after a stale cancellation and requires explicit content save", async () => {
    vi.mocked(api.updateAction).mockRejectedValueOnce(new api.ApiError("CONFLICT", "Changed", 409));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); fireEvent.click(screen.getByText("Cancel action")); change("Result", "Cancellation draft");
    fireEvent.click(screen.getByText("Cancel action")); await screen.findByText(/Your draft is preserved/);
    vi.mocked(api.getActions).mockResolvedValue(page([{ ...action, status: "COMPLETED", version: 2 }]));
    fireEvent.click(screen.getByText("Reload for review")); await screen.findByText(/Current server version 2/);
    fireEvent.click(screen.getByText("Use current version for explicit retry"));
    expect(screen.queryByText("Cancel action")).not.toBeInTheDocument(); expect(screen.getByText("Save Action")).toBeEnabled();
    expect(screen.getByLabelText("Result", { exact: false })).toHaveValue("Cancellation draft");
    expect(api.updateAction).toHaveBeenCalledOnce();
  });
  it("replays the original uncertain create after the assignee is excluded from the refreshed lookup", async () => {
    const records = new Map<string, api.ActionTaken>();
    vi.mocked(api.createAction).mockImplementation(async (_ticket, input) => {
      const saved = records.get(input.clientRequestId);
      if (saved) return { ...mutation(saved), replay: true };
      records.set(input.clientRequestId, { ...action, actionDescription: input.actionDescription, assignee: { ...other, isActive: true } });
      throw new TypeError("Response lost after commit");
    });
    setup(); await openNew(); fillNew(); change("Action Assignee", other.id);
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/Check your connection/);
    const original = { ...vi.mocked(api.createAction).mock.calls[0][1] };
    vi.mocked(api.getEligibleOwners).mockResolvedValue([{ id: staff.id, name: staff.name, role: "IT_STAFF" }]);
    fireEvent.change(screen.getByLabelText("Actions per page"), { target: { value: "50" } });
    await waitFor(() => expect(screen.queryByRole("option", { name: "Administrator (ADMINISTRATOR)" })).not.toBeInTheDocument());
    expect(screen.getByText("Save Action")).toBeEnabled();
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(vi.mocked(api.createAction).mock.calls[1][1]).toEqual(original);
    expect(records.size).toBe(1); expect(api.createAction).toHaveBeenCalledTimes(2);
  });
  it("does not reuse an uncertain create key for changed content and rejects an ineligible new intent", async () => {
    vi.mocked(api.createAction).mockRejectedValue(new TypeError("Lost response"));
    setup(); await openNew(); fillNew(); change("Action Assignee", other.id);
    fireEvent.click(screen.getByText("Save Action")); await screen.findByText(/Check your connection/);
    const original = vi.mocked(api.createAction).mock.calls[0][1];
    vi.mocked(api.getEligibleOwners).mockResolvedValue([{ id: staff.id, name: staff.name, role: "IT_STAFF" }]);
    fireEvent.change(screen.getByLabelText("Actions per page"), { target: { value: "50" } });
    await waitFor(() => expect(screen.queryByRole("option", { name: "Administrator (ADMINISTRATOR)" })).not.toBeInTheDocument());
    change("Result", "Changed outcome"); fireEvent.click(screen.getByText("Save Action"));
    await screen.findByText("Select an eligible active IT Staff or Administrator.");
    expect(api.createAction).toHaveBeenCalledOnce();
    change("Action Assignee", staff.id); fireEvent.click(screen.getByText("Save Action"));
    await waitFor(() => expect(api.createAction).toHaveBeenCalledTimes(2));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("new logical Action"));
    expect(vi.mocked(api.createAction).mock.calls[1][1].clientRequestId).not.toBe(original.clientRequestId);
  });
  it("retries failed page 2 and displays its distinct records and metadata", async () => {
    vi.mocked(api.getActions).mockResolvedValueOnce(page([action], 1, 21)).mockRejectedValueOnce(new TypeError("Offline"))
      .mockResolvedValueOnce(page([{ ...action, id: "page-two", actionDescription: "Only on page two" }], 2, 21));
    setup(); await screen.findByText(action.actionDescription); fireEvent.click(screen.getByText("Next Actions"));
    await screen.findByText(/Check your connection/); fireEvent.click(screen.getByRole("button", { name: /Retry: Actions/ }));
    await screen.findByText("Only on page two");
    expect(api.getActions).toHaveBeenLastCalledWith(action.ticketId, true, { page: 2, pageSize: 20 });
    expect(screen.getByText("Page 2 of 2 (21 Actions)")).toBeInTheDocument();
    expect(screen.queryByText(action.actionDescription)).not.toBeInTheDocument();
  });
  it("retries the exact failed focus query", async () => {
    window.history.replaceState({}, "", "/#action-" + action.id);
    vi.mocked(api.getActions).mockRejectedValueOnce(new TypeError("Offline")).mockResolvedValueOnce(page());
    setup(); await screen.findByText(/Check your connection/); fireEvent.click(screen.getByRole("button", { name: /Retry: Actions/ }));
    await screen.findByText(action.actionDescription);
    expect(vi.mocked(api.getActions).mock.calls[1]).toEqual(vi.mocked(api.getActions).mock.calls[0]);
    expect(api.getActions).toHaveBeenLastCalledWith(action.ticketId, true, { pageSize: 20, focusActionId: action.id });
  });
  it("resets a failed pagination query on page-size change", async () => {
    vi.mocked(api.getActions).mockResolvedValueOnce(page([action], 1, 21)).mockRejectedValueOnce(new TypeError("Offline")).mockRejectedValueOnce(new TypeError("Still offline"))
      .mockResolvedValueOnce({ ...page(), meta: { ...page().meta, pageSize: 50 } });
    setup(); await screen.findByText(action.actionDescription); fireEvent.click(screen.getByText("Next Actions")); await screen.findByText(/Check your connection/);
    fireEvent.change(screen.getByLabelText("Actions per page"), { target: { value: "50" } }); await screen.findByText(/Check your connection/);
    fireEvent.click(screen.getByRole("button", { name: /Retry: Actions/ }));
    await waitFor(() => expect(api.getActions).toHaveBeenCalledTimes(4));
    expect(api.getActions).toHaveBeenLastCalledWith(action.ticketId, true, { page: 1, pageSize: 50 });
  });
  it("ignores older history responses within the same mounted component", async () => {
    const old = deferred<api.ActionHistory>(); vi.mocked(api.getActions).mockImplementationOnce(() => old.promise);
    const view = setup();
    // A hash change starts a newer bounded history request before the initial response arrives.
    vi.mocked(api.getActions).mockResolvedValueOnce(page([{ ...action, actionDescription: "Newest history" }]));
    act(() => { window.history.replaceState({}, "", "/#action-" + action.id); window.dispatchEvent(new HashChangeEvent("hashchange")); });
    await screen.findByText("Newest history");
    await act(async () => old.resolve(page([{ ...action, actionDescription: "Obsolete history" }])));
    expect(screen.queryByText("Obsolete history")).not.toBeInTheDocument();
    expect(screen.getByText("Newest history")).toBeInTheDocument(); view.unmount();
  });
  it("marks the completed clearing explanation required and associates helper and validation text", async () => {
    vi.mocked(api.getActions).mockResolvedValue(page([{ ...action, status: "COMPLETED", followUpRequired: true, followUpNote: "Old plan" }]));
    setup(); fireEvent.click(await screen.findByRole("button", { name: /Edit Action:/ })); fireEvent.click(screen.getByLabelText("Follow-up Required?"));
    const note = screen.getByLabelText("Follow-up Note", { exact: false });
    expect(note).toBeRequired(); expect(note).toHaveAttribute("aria-required", "true");
    expect(note).toHaveAttribute("aria-describedby", "action-followUpNote-helper");
    expect(note).toHaveAccessibleDescription(/new explanation.*required.*different/);
    expect(document.querySelector('label[for="action-followUpNote"]')).toHaveTextContent("*");
    change("Follow-up Note", " "); fireEvent.click(screen.getByText("Save Action"));
    expect(note).toHaveAttribute("aria-invalid", "true"); expect(note).toHaveAttribute("aria-describedby", "action-followUpNote-helper action-followUpNote-error");
    expect(api.updateAction).not.toHaveBeenCalled();
    change("Follow-up Note", "Verified by the Requester"); fireEvent.click(screen.getByText("Save Action")); await screen.findByText("Action saved.");
    expect(api.updateAction).toHaveBeenCalledWith(action.ticketId, action.id, expect.objectContaining({ expectedVersion: 1, followUpRequired: false, followUpNote: "Verified by the Requester" }));
  });
  it.each(["success", "failure"] as const)("keeps newer lookup success after older %s", async outcome => {
    const old = deferred<api.EligibleOwner[]>(); vi.mocked(api.getEligibleOwners).mockImplementationOnce(() => old.promise).mockResolvedValueOnce([other]);
    setup(); await screen.findByText(action.actionDescription);
    fireEvent.change(screen.getByLabelText("Actions per page"), { target: { value: "50" } }); await openNew();
    await screen.findByRole("option", { name: "Administrator (ADMINISTRATOR)" });
    await act(async () => { if (outcome === "success") old.resolve([{ id: staff.id, name: "Obsolete staff", role: "IT_STAFF" }]); else old.reject(new TypeError("Old lookup failure")); });
    expect(screen.getByRole("option", { name: "Administrator (ADMINISTRATOR)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Obsolete staff/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Unable to load eligible assignees/)).not.toBeInTheDocument();
    expect(screen.queryByText("Loading eligible assignees...")).not.toBeInTheDocument();
  });
  it("keeps newer lookup failure after an older success", async () => {
    const old = deferred<api.EligibleOwner[]>(); vi.mocked(api.getEligibleOwners).mockImplementationOnce(() => old.promise).mockRejectedValueOnce(new TypeError("Latest lookup failure"));
    setup(); await screen.findByText(action.actionDescription);
    fireEvent.change(screen.getByLabelText("Actions per page"), { target: { value: "50" } }); await screen.findByText(/Unable to load eligible assignees/); await openNew();
    await act(async () => old.resolve([other]));
    expect(screen.getByText(/Unable to load eligible assignees/)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Administrator (ADMINISTRATOR)" })).not.toBeInTheDocument();
    expect(screen.getByText("Save Action")).toBeDisabled();
  });
  it.each(["ticket", "user"] as const)("invalidates old lookup and retry state on %s change", async kind => {
    const old = deferred<api.EligibleOwner[]>(); vi.mocked(api.getEligibleOwners).mockImplementationOnce(() => old.promise).mockResolvedValueOnce([other]);
    vi.mocked(api.getActions).mockResolvedValueOnce(page([action], 1, 21)).mockRejectedValueOnce(new TypeError("Old page failed")).mockResolvedValue(page([{ ...action, actionDescription: "New identity history" }]));
    const view = setup(); await screen.findByText(action.actionDescription);
    fireEvent.click(screen.getByText("Next Actions")); await screen.findByText(/Check your connection/);
    const id = kind === "ticket" ? "new-ticket" : action.ticketId;
    view.rerender(<ActionsTaken ticketId={id} ticketStatus="OPEN" currentUser={kind === "user" ? { ...staff, id: other.id } : staff}/>);
    await screen.findByText("New identity history"); await openNew();
    await act(async () => old.resolve([{ id: staff.id, name: "Obsolete identity staff", role: "IT_STAFF" }]));
    expect(screen.queryByRole("option", { name: /Obsolete identity staff/ })).not.toBeInTheDocument();
    expect(api.getActions).toHaveBeenLastCalledWith(id, true, { page: 1, pageSize: 20 });
    expect(screen.queryByRole("button", { name: /Retry: Actions/ })).not.toBeInTheDocument();
  });
});
