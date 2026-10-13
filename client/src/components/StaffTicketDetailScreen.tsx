import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, AuthUser, EligibleOwner, getEligibleOwners, getStaffTicket, postComment, postInternalNote, StaffTicketDetail, StaffTicketPriority, StaffTicketStatus, ResolutionReason, updateStaffOwner, updateStaffPriority, updateStaffStatus } from "../api.js";

import FormField from "./common/FormField.js";
import ActionsTaken from "./ActionsTaken.js";

const transitions: Record<StaffTicketStatus, StaffTicketStatus[]> = {
  NEW: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"], CLOSED: ["REOPENED"],
  REOPENED: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  CANCELLED: ["REOPENED"],
};
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const date = (value: string) => new Date(value).toLocaleString();

const reasonLabels: Record<ResolutionReason, string> = {
  NO_COMPLETED_ACTIONS: "At least one completed Action is required.",
  PENDING_ACTIONS: "Pending Actions must be completed or cancelled.",
  FOLLOW_UP_REQUIRED: "Completed Actions still require follow-up. Address the work and record a new explanation when clearing the flag.",
};

type DetailProps = { ticketId: string; currentUser: AuthUser; onBack: () => void };
export default function StaffTicketDetailScreen(props: DetailProps) {
  if (props.currentUser.role === "REQUESTER" || !props.currentUser.isActive || props.currentUser.mustChangePassword) return <p role="alert">Ticket detail is unavailable for your session or role.</p>;
  return <StaffTicketDetailContent key={props.currentUser.id + ":" + props.currentUser.role + ":" + props.ticketId} {...props}/>;
}
function StaffTicketDetailContent({ ticketId, currentUser, onBack }: DetailProps) {
  const [ticket, setTicket] = useState<StaffTicketDetail | null>(null);
  const [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const parentMutationDisabled = busy || loading;
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [workflowReview, setWorkflowReview] = useState(false);
  const [gateReasons, setGateReasons] = useState<ResolutionReason[]>([]);
  const pending = useRef(false);
  const lifetime = useRef(0);
  const [ownerId, setOwnerId] = useState("");
  const [priority, setPriority] = useState<StaffTicketPriority>("MEDIUM");
  const [status, setStatus] = useState<StaffTicketStatus | "">("");
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const confirmedTicket = useRef<StaffTicketDetail | null>(null);
  const generation = useRef(0);
  const clearAccess = useCallback(() => {
    ++generation.current; ++lifetime.current; confirmedTicket.current = null;
    setTicket(null); setOwners([]); setComment(""); setNote(""); setSuccess(""); setFieldErrors({});
    setOwnerId(""); setStatus(""); setLoading(false); pending.current = false; setBusy(false);
    setError("You are not permitted to view this ticket. Your session or access changed.");
  }, []);
  const load = useCallback(async (): Promise<boolean> => {
    const token = ++generation.current;
    setLoading(true); setError("");
    try {
      const [detail, eligible] = await Promise.all([getStaffTicket(ticketId), getEligibleOwners()]);
      if (token !== generation.current) return false;
      confirmedTicket.current = detail;
      setTicket(detail); setOwners(eligible); setOwnerId(detail.owner?.id ?? ""); setPriority(detail.itPriority); setStatus(""); setWorkflowReview(false); setGateReasons([]);
      return true;
    } catch (cause) {
      if (token !== generation.current) return false;
      const accessLost = cause instanceof ApiError && ([401, 403, 404].includes(cause.status) || cause.code === "PASSWORD_CHANGE_REQUIRED");
      if (accessLost || !confirmedTicket.current) {
        ++lifetime.current; confirmedTicket.current = null; pending.current = false; setBusy(false);
        setTicket(null); setOwners([]); setSuccess(""); setComment(""); setNote("");
        setError(cause instanceof ApiError && cause.status === 403 ? "You are not permitted to view this ticket." : cause instanceof ApiError && cause.status === 404 ? "Ticket not found." : cause instanceof ApiError && cause.status === 401 ? "Your session is unavailable. Please sign in again." : "Unable to load ticket detail. Please retry.");
      } else {
        setWorkflowReview(true);
        setError("Ticket refresh failed. Previously loaded detail and unsaved Actions are preserved. Retry to review the current Ticket.");
      }
      return false;
    }
    finally { if (token === generation.current) setLoading(false); }
  }, [ticketId]);
  useEffect(() => { void load(); return () => { ++generation.current; ++lifetime.current; }; }, [load]);
  const save = async (action: () => Promise<unknown>, message: string, workflow = false) => {
    if (pending.current || loading || (workflow && workflowReview)) return;
    pending.current = true;
    const token = lifetime.current;
    setBusy(true); setError(""); setSuccess(""); setGateReasons([]);
    try {
      await action();
      if (token !== lifetime.current) return;
      setSuccess(message);
      // The write is confirmed even if its following GET fails. Never repeat it.
      if (workflow) { setWorkflowReview(true); setStatus(""); }
      await load();
    } catch (cause) {
      if (token !== lifetime.current) return;
      if (cause instanceof ApiError && ([401, 403, 404].includes(cause.status) || cause.code === "PASSWORD_CHANGE_REQUIRED")) {
        clearAccess(); return;
      }
      if (workflow && cause instanceof ApiError && cause.code === "RESOLUTION_REQUIREMENTS_NOT_MET") {
        setGateReasons(cause.reasonCodes);
        setError("Resolution requirements are not met. Review Actions Taken and refresh eligibility.");
      } else if (workflow) {
        setWorkflowReview(true); setStatus("");
        setError(cause instanceof ApiError && cause.code === "CONFLICT"
          ? "Ticket state changed. Refresh Ticket detail, review the current state and choose a transition again."
          : cause instanceof ApiError && cause.status < 500 ? cause.message : "Unable to confirm the status update. Refresh Ticket detail for review before another transition.");
      } else setError(cause instanceof ApiError && cause.status < 500 ? cause.message : "Unable to save. Please retry.");
    } finally {
      if (token === lifetime.current) { pending.current = false; setBusy(false); }
    }
  };
  const changeStatus = () => {
    if (!ticket || !status || pending.current || loading || workflowReview) return;
    const implications = status === "RESOLVED" ? " I confirm I reviewed the completed work and outstanding follow-up."
      : status === "CLOSED" ? " Closing requires the current resolution gate when Actions exist; legacy zero-Action Tickets may close."
      : status === "CANCELLED" ? " Existing Actions and their history will be retained without automatic cancellation."
      : status === "REOPENED" ? " New work becomes available; terminal Actions remain unchanged." : "";
    if (window.confirm(`${ticket.ticketNumber}: change ${label(ticket.status)} to ${label(status)}?${implications}`))
      void save(() => updateStaffStatus(ticketId, status, ticket.workflowVersion), "Status updated. Refresh to review confirmed Ticket detail if necessary.", true);
  };
  const validText = (content: string, kind: string) => {
    const message = content.trim().length < 1 || content.trim().length > 2000 ? `${kind} must contain 1 to 2000 characters after trimming.` : "";
    setFieldErrors(previous => ({ ...previous, [kind]: message }));
    return !message;
  };
  return <div className="container-fluid px-0">
    <button className="btn btn-outline-primary-green mb-3" onClick={onBack}>Back to Ticket Queue</button>
    {loading && !ticket && <div role="status">Loading ticket detail...</div>}
    {error && <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger ms-2" disabled={parentMutationDisabled} onClick={() => void load()}>Retry</button></div>}
    {success && <div role="status" className="alert alert-success">{success}</div>}
    {ticket && <>
      <button className="btn btn-outline-primary-green mb-3" disabled={parentMutationDisabled} onClick={() => void load()}>Refresh Ticket detail</button>
      <header className="zen-card p-4 mb-3"><h1 className="h3 text-primary-green">{ticket.ticketNumber}: {ticket.summary}</h1><p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</p></header>
      <div className="row g-3 mb-3"><section className="col-12 col-lg-6"><div className="zen-card p-4 h-100"><h2 className="h5">Ticket Information</h2><dl className="row mb-0">
        <dt className="col-5">Requester</dt><dd className="col-7 text-break">{ticket.requester.name} ({ticket.requester.email})</dd>
        <dt className="col-5">Category</dt><dd className="col-7">{ticket.category.name}</dd><dt className="col-5">Related System</dt><dd className="col-7">{ticket.relatedSystem.name}</dd>
        <dt className="col-5">Created</dt><dd className="col-7">{date(ticket.createdAt)}</dd><dt className="col-5">Updated</dt><dd className="col-7">{date(ticket.updatedAt)}</dd>
        <dt className="col-5">Problem Appears Resolved</dt><dd className="col-7">{ticket.problemAppearsResolvedAt ? date(ticket.problemAppearsResolvedAt) : "Not indicated"}</dd>
      </dl></div></section>
      <section className="col-12 col-lg-6"><div className="zen-card p-4 h-100"><h2 className="h5">Workflow</h2><p><strong>Requested Priority:</strong> {label(ticket.requestedPriority)}</p>
        <label className="form-label" htmlFor="staff-it-priority">IT Priority</label><div className="d-flex gap-2 flex-wrap mb-3"><select id="staff-it-priority" className="form-select flex-grow-1" style={{ minWidth: 160 }} value={priority} disabled={parentMutationDisabled} onChange={e => setPriority(e.target.value as StaffTicketPriority)}>{(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map(v => <option key={v} value={v}>{label(v)}</option>)}</select><button className="btn btn-primary-green" disabled={parentMutationDisabled || priority === ticket.itPriority} onClick={() => void save(() => updateStaffPriority(ticketId, priority), "IT Priority updated.")}>Save IT Priority</button></div>
        <p><strong>Current Status:</strong> {label(ticket.status)}</p><label className="form-label" htmlFor="staff-status">Next Status</label><div className="d-flex gap-2 flex-wrap"><select id="staff-status" className="form-select flex-grow-1" style={{ minWidth: 160 }} value={status} disabled={parentMutationDisabled || workflowReview} aria-describedby="workflow-eligibility" onChange={e => setStatus(e.target.value as StaffTicketStatus)}><option value="">Choose status</option>{transitions[ticket.status].map(v => <option key={v} value={v}>{label(v)}</option>)}</select><button className="btn btn-primary-green" disabled={parentMutationDisabled || workflowReview || !status} onClick={changeStatus}>Update Status</button></div>
        <div id="workflow-eligibility" className="mt-3" aria-live="polite">
          <p>Workflow version: {ticket.workflowVersion}</p>
          <p>Actions: {ticket.actionsTakenSummary.totalItems} total; {ticket.actionsTakenSummary.pendingItems} pending; {ticket.actionsTakenSummary.completedItems} completed; {ticket.actionsTakenSummary.cancelledItems} cancelled; {ticket.actionsTakenSummary.followUpRequiredItems} completed with follow-up.</p>
          <p>{ticket.resolutionEligibility.eligible && !gateReasons.length ? "Resolution requirements met. Staff review is required." : "Resolution requirements are not met."}</p>
          <ul>{(gateReasons.length ? gateReasons : ticket.resolutionEligibility.reasonCodes).map(reason => <li key={reason}>{reasonLabels[reason]}</li>)}</ul>
          <p>Cancelled actions are retained but do not count as completed evidence. Requester indication is advisory.</p>
          {ticket.status === "RESOLVED" && ticket.actionsTakenSummary.totalItems === 0 && <p>This legacy zero-Action resolved Ticket may close.</p>}
          <a href="#actions-title" onClick={() => document.getElementById("actions-title")?.focus()}>Review Actions Taken</a>
        </div>
        {workflowReview && <p role="status">Workflow changes are paused. Refresh Ticket detail, review the current state and choose again.</p>}
      </div></section></div>
      <section className="zen-card p-4 mb-3"><h2 className="h5">Ticket Ownership</h2><p>Current owner: <strong>{ticket.owner?.name ?? "Unassigned"}</strong></p><div className="d-flex gap-2 flex-wrap">{!ticket.owner && <button className="btn btn-primary-green" disabled={parentMutationDisabled} onClick={() => void save(() => updateStaffOwner(ticketId, currentUser.id), "Ticket claimed.")}>Claim Ticket</button>}<label className="visually-hidden" htmlFor="staff-owner">Assign or reassign owner</label><select id="staff-owner" className="form-select flex-grow-1" style={{ minWidth: 180 }} value={ownerId} disabled={parentMutationDisabled} onChange={e => setOwnerId(e.target.value)}><option value="">Unassigned</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} ({label(owner.role)})</option>)}</select><button className="btn btn-outline-primary-green" disabled={parentMutationDisabled || ownerId === (ticket.owner?.id ?? "")} onClick={() => void save(() => updateStaffOwner(ticketId, ownerId || null), "Owner updated.")}>Save Owner</button></div></section>
      <section className="zen-card p-4 mb-3"><h2 className="h5">Attachments</h2>{ticket.attachments.length ? <ul>{ticket.attachments.map(a => <li className="text-break" key={a.id}><a href={`/api/staff/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(a.id)}/download`}>{a.originalFilename}</a> ({Math.ceil(a.sizeBytes / 1024)} KB)</li>)}</ul> : <p>No attachments.</p>}</section>
      <div className="row g-3"><section className="col-12 col-lg-6"><div className="zen-card p-4 h-100"><h2 className="h5">Public Comments</h2><p className="text-secondary">Visible to the Requester. Do not include private staff information.</p>{ticket.publicComments.map(item => <article className="border-top py-2" key={item.id}><strong>{item.author.name}</strong> <time className="text-secondary small" dateTime={item.createdAt}>{date(item.createdAt)}</time><p className="text-break mb-0" style={{ whiteSpace: "pre-wrap" }}>{item.content}</p></article>)}<FormField id="staff-comment" label="Public Comment" className="mt-3" error={fieldErrors.Comment}><textarea className="form-control" disabled={parentMutationDisabled} maxLength={2000} value={comment} onChange={e => { setComment(e.target.value); setFieldErrors(previous => ({ ...previous, Comment: "" })); }} /></FormField><button className="btn btn-primary-green mt-2" disabled={parentMutationDisabled} onClick={() => { if (validText(comment, "Comment")) void save(async () => { await postComment(ticketId, comment); setComment(""); }, "Public Comment added."); }}>Post Public Comment</button></div></section>
      <section className="col-12 col-lg-6"><div className="zen-card p-4 h-100 border border-warning"><h2 className="h5">Internal Notes</h2><p className="text-secondary">Private to IT Staff and Administrators. The Requester cannot see these notes.</p>{ticket.internalNotes.map(item => <article className="border-top py-2" key={item.id}><strong>{item.author.name}</strong> <time className="text-secondary small" dateTime={item.createdAt}>{date(item.createdAt)}</time><p className="text-break mb-0" style={{ whiteSpace: "pre-wrap" }}>{item.content}</p></article>)}<FormField id="staff-note" label="Internal Note" className="mt-3" error={fieldErrors.Note}><textarea className="form-control" disabled={parentMutationDisabled} maxLength={2000} value={note} onChange={e => { setNote(e.target.value); setFieldErrors(previous => ({ ...previous, Note: "" })); }} /></FormField><button className="btn btn-outline-primary-green mt-2" disabled={parentMutationDisabled} onClick={() => { if (validText(note, "Note")) void save(async () => { await postInternalNote(ticketId, note); setNote(""); }, "Internal Note added."); }}>Add Internal Note</button></div></section></div>
      <ActionsTaken key={currentUser.id + ticketId} ticketId={ticketId} ticketNumber={ticket.ticketNumber} ticketStatus={ticket.status} currentUser={currentUser} onSaved={load} onRefreshTicket={load} onAccessLost={clearAccess}/>
    </>}
  </div>;
}
