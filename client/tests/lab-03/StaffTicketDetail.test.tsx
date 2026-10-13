import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getStaffTicket, getEligibleOwners, updateStaffPriority, updateStaffStatus, updateStaffOwner, postComment, postInternalNote } from "../../src/api.js";
import StaffTicketDetailScreen from "../../src/components/StaffTicketDetailScreen.js";

vi.mock("../../src/api.js", async () => ({ ...await vi.importActual<typeof import("../../src/api.js")>("../../src/api.js"), getActions: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }), getStaffTicket: vi.fn(), getEligibleOwners: vi.fn(), updateStaffPriority: vi.fn(), updateStaffStatus: vi.fn(), updateStaffOwner: vi.fn(), postComment: vi.fn(), postInternalNote: vi.fn() }));
const detail = { id: "ticket-1", ticketNumber: "TKT-1", summary: "Wi-Fi issue", description: "Cannot connect", category: { id: 1, name: "Network" }, relatedSystem: { id: "sys", name: "Campus Wi-Fi" }, requester: { id: "requester", name: "Alice", email: "alice@example.com" }, requestedPriority: "HIGH", itPriority: "MEDIUM", status: "NEW", owner: null, ticketDate: "2026-09-19T00:00:00Z", createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z", workflowVersion: 0, actionsTakenSummary: { totalItems: 0, pendingItems: 0, completedItems: 0, cancelledItems: 0, followUpRequiredItems: 0 }, resolutionEligibility: { eligible: false, reasonCodes: ["NO_COMPLETED_ACTIONS"] }, problemAppearsResolvedAt: null, attachments: [], publicComments: [], internalNotes: [] } as const;
const user = { id: "staff", name: "Staff", email: "staff@example.com", role: "IT_STAFF", isActive: true, mustChangePassword: false } as const;
beforeEach(() => { vi.clearAllMocks(); vi.mocked(getStaffTicket).mockResolvedValue(detail as never); vi.mocked(getEligibleOwners).mockResolvedValue([{ id: "staff", name: "Staff", role: "IT_STAFF" }]); vi.mocked(updateStaffPriority).mockResolvedValue({ itPriority: "LOW" }); vi.mocked(updateStaffStatus).mockResolvedValue({ status: "OPEN", workflowVersion: 1 }); vi.mocked(updateStaffOwner).mockResolvedValue({ owner: null }); vi.mocked(postComment).mockResolvedValue({} as never); vi.mocked(postInternalNote).mockResolvedValue({} as never); });
describe("Staff Ticket Detail", () => {
  it("loads ticket information and separates public from private communication", async () => {
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading ticket detail");
    expect(await screen.findByText(/TKT-1: Wi-Fi issue/)).toBeInTheDocument();
    expect(screen.getByText("Cannot connect")).toBeInTheDocument();
    expect(screen.getByText(/Visible to the Requester/)).toBeInTheDocument();
    expect(screen.getByText(/Private to IT Staff/)).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent?.includes("Requested Priority: High") === true)).toBeInTheDocument();
  });
  it("claims and updates workflow controls", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    await screen.findByText(/TKT-1: Wi-Fi issue/);
    fireEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
    await waitFor(() => expect(updateStaffOwner).toHaveBeenCalledWith("ticket-1", "staff"));
    await waitFor(() => expect(screen.getByLabelText("IT Priority")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "LOW" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    await waitFor(() => expect(updateStaffPriority).toHaveBeenCalledWith("ticket-1", "LOW"));
    await waitFor(() => expect(screen.getByLabelText("Next Status")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Next Status"), { target: { value: "OPEN" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Status" }));
    await waitFor(() => expect(updateStaffStatus).toHaveBeenCalledWith("ticket-1", "OPEN", 0));
  });
  it("validates and posts each communication type", async () => {
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    await screen.findByText(/TKT-1: Wi-Fi issue/);
    fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Note must contain");
    fireEvent.change(screen.getByLabelText("Internal Note"), { target: { value: "Private note" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    await waitFor(() => expect(postInternalNote).toHaveBeenCalledWith("ticket-1", "Private note"));
    await waitFor(() => expect(screen.getByLabelText("Public Comment")).toBeEnabled());
    fireEvent.change(screen.getByLabelText("Public Comment"), { target: { value: "Public reply" } });
    fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    await waitFor(() => expect(postComment).toHaveBeenCalledWith("ticket-1", "Public reply"));
  });
  it("shows a safe retry state and navigates back", async () => {
    vi.mocked(getStaffTicket).mockRejectedValueOnce(new Error("server secret"));
    const onBack = vi.fn();
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={onBack} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load ticket detail");
    expect(screen.getByRole("alert")).not.toHaveTextContent("server secret");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/TKT-1: Wi-Fi issue/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Ticket Queue" }));
    expect(onBack).toHaveBeenCalled();
  });
  it("offers only transitions permitted from the current status", async () => {
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    const select = await screen.findByLabelText("Next Status");
    expect(Array.from(select.querySelectorAll("option")).map(option => option.value)).toEqual(["", "OPEN", "IN_PROGRESS", "CANCELLED"]);
  });
  it("removes stale private detail and suppresses success when refresh is forbidden", async () => {
    vi.mocked(getStaffTicket).mockResolvedValueOnce({ ...detail, internalNotes: [{ id: "note-1", ticketId: "ticket-1", content: "private staff note", author: { id: "staff", name: "Staff", role: "IT_STAFF" }, createdAt: detail.createdAt }] } as never)
      .mockRejectedValueOnce(new ApiError("FORBIDDEN", "Forbidden", 403));
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    expect(await screen.findByText("private staff note")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("not permitted");
    expect(screen.queryByText("private staff note")).not.toBeInTheDocument();
    expect(screen.queryByText("Ticket claimed.")).not.toBeInTheDocument();
  });
});

describe("Staff field feedback", () => {
  it.each([
    ["Public Comment", "Post Public Comment", "staff-comment", postComment],
    ["Internal Note", "Add Internal Note", "staff-note", postInternalNote],
  ] as const)("associates invalid %s with its control and clears feedback on correction", async (label, action, id, request) => {
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    const field = await screen.findByLabelText(label);
    for (const value of ["   ", "x".repeat(2001)]) {
      fireEvent.change(field, { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: action }));
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAttribute("aria-describedby", `${id}-error`);
      expect(field).toHaveAccessibleDescription(/must contain 1 to 2000 characters/);
      expect(request).not.toHaveBeenCalled();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    }
    fireEvent.change(field, { target: { value: "Valid communication" } });
    expect(field).not.toHaveAttribute("aria-invalid");
    fireEvent.click(screen.getByRole("button", { name: action }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("ticket-1", "Valid communication"));
  });
  it("retains a general safe alert for API failures without marking valid text invalid", async () => {
    vi.mocked(postComment).mockRejectedValueOnce(new Error("private server detail"));
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    const field = await screen.findByLabelText("Public Comment");
    fireEvent.change(field, { target: { value: "Valid reply" } });
    fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save. Please retry.");
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(field).toHaveValue("Valid reply");
  });
});

describe("Parent refresh mutation controls", () => {
  const controls = () => [
    ...["Save IT Priority", "Claim Ticket", "Save Owner", "Post Public Comment", "Add Internal Note", "Update Status"].map(name => screen.getByRole("button", { name })),
    ...["IT Priority", "Assign or reassign owner", "Public Comment", "Internal Note", "Next Status"].map(label => screen.getByLabelText(label)),
  ];
  it("disables every parent mutation during a delayed GET, then permits explicit priority/ownership/communication writes", async () => {
    vi.mocked(getEligibleOwners).mockResolvedValue([{ id: "staff", name: "Staff", role: "IT_STAFF" }, { id: "admin", name: "Admin", role: "ADMINISTRATOR" }]);
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    await screen.findByLabelText("Next Status");
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "HIGH" } });
    fireEvent.change(screen.getByLabelText("Assign or reassign owner"), { target: { value: "admin" } });
    fireEvent.change(screen.getByLabelText("Public Comment"), { target: { value: "Retained public draft" } });
    fireEvent.change(screen.getByLabelText("Internal Note"), { target: { value: "Retained private draft" } });
    let finish!: () => void;
    vi.mocked(getStaffTicket).mockReturnValueOnce(new Promise(resolve => { finish = () => resolve(detail as never); }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Ticket detail" }));
    for (const control of controls()) expect(control).toBeDisabled();
    for (const name of ["Save IT Priority", "Claim Ticket", "Save Owner", "Post Public Comment", "Add Internal Note", "Update Status"]) fireEvent.click(screen.getByRole("button", { name }));
    for (const mutation of [updateStaffPriority, updateStaffOwner, postComment, postInternalNote, updateStaffStatus]) expect(mutation).not.toHaveBeenCalled();
    await act(async () => finish());
    for (const label of ["IT Priority", "Assign or reassign owner", "Public Comment", "Internal Note", "Next Status"]) expect(screen.getByLabelText(label)).toBeEnabled();
    expect(screen.getByLabelText("Public Comment")).toHaveValue("Retained public draft");
    expect(screen.getByLabelText("Internal Note")).toHaveValue("Retained private draft");
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "HIGH" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Claim Ticket" })).toBeEnabled());
    expect(updateStaffPriority).toHaveBeenCalledTimes(1); expect(updateStaffPriority).toHaveBeenCalledWith("ticket-1", "HIGH");
    fireEvent.click(screen.getByRole("button", { name: "Claim Ticket" }));
    await waitFor(() => expect(screen.getByLabelText("Assign or reassign owner")).toBeEnabled());
    expect(updateStaffOwner).toHaveBeenCalledTimes(1); expect(updateStaffOwner).toHaveBeenCalledWith("ticket-1", "staff");
    fireEvent.change(screen.getByLabelText("Assign or reassign owner"), { target: { value: "admin" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Owner" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Post Public Comment" })).toBeEnabled());
    expect(updateStaffOwner).toHaveBeenCalledTimes(2); expect(updateStaffOwner).toHaveBeenLastCalledWith("ticket-1", "admin");
    fireEvent.click(screen.getByRole("button", { name: "Post Public Comment" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add Internal Note" })).toBeEnabled());
    expect(postComment).toHaveBeenCalledTimes(1); expect(postComment).toHaveBeenCalledWith("ticket-1", "Retained public draft");
    fireEvent.click(screen.getByRole("button", { name: "Add Internal Note" }));
    await waitFor(() => expect(screen.getByLabelText("Internal Note")).toBeEnabled());
    expect(postInternalNote).toHaveBeenCalledTimes(1); expect(postInternalNote).toHaveBeenCalledWith("ticket-1", "Retained private draft");
  });
  it("re-enables non-workflow controls after recoverable refresh failure while workflow still requires review", async () => {
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    await screen.findByLabelText("Next Status");
    let fail!: (error: Error) => void;
    vi.mocked(getStaffTicket).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Ticket detail" }));
    for (const control of controls()) expect(control).toBeDisabled();
    await act(async () => fail(new Error("Recoverable network failure")));
    expect(screen.getByLabelText("Next Status")).toBeDisabled();
    for (const label of ["IT Priority", "Assign or reassign owner", "Public Comment", "Internal Note"]) expect(screen.getByLabelText(label)).toBeEnabled();
    fireEvent.change(screen.getByLabelText("IT Priority"), { target: { value: "HIGH" } });
    fireEvent.click(screen.getByRole("button", { name: "Save IT Priority" }));
    await waitFor(() => expect(screen.getByLabelText("Next Status")).toBeEnabled());
    expect(updateStaffPriority).toHaveBeenCalledTimes(1); expect(updateStaffPriority).toHaveBeenCalledWith("ticket-1", "HIGH");
  });
  it.each([401, 403, 404])("clears controls and protected drafts when the delayed refresh loses access (%s)", async status => {
    render(<StaffTicketDetailScreen ticketId="ticket-1" currentUser={user} onBack={vi.fn()} />);
    await screen.findByLabelText("Next Status");
    fireEvent.change(screen.getByLabelText("Internal Note"), { target: { value: "Protected correction draft" } });
    let fail!: (error: Error) => void;
    vi.mocked(getStaffTicket).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Ticket detail" }));
    for (const control of controls()) expect(control).toBeDisabled();
    await act(async () => fail(new ApiError("ACCESS_LOST", "Unavailable", status)));
    expect(screen.queryByLabelText("Internal Note")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Next Status")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Actions Taken" })).not.toBeInTheDocument();
    expect(postInternalNote).not.toHaveBeenCalled();
  });
});
