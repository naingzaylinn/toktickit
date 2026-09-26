import { useCallback, useEffect, useState } from "react";
import { ApiError, AuthUser, EligibleOwner, getEligibleOwners, getStaffTicket, postComment, postInternalNote, StaffTicketDetail, StaffTicketPriority, StaffTicketStatus, updateStaffOwner, updateStaffPriority, updateStaffStatus } from "../api.js";

import FormField from "./common/FormField.js";

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

export default function StaffTicketDetailScreen({ ticketId, currentUser, onBack }: { ticketId: string; currentUser: AuthUser; onBack: () => void }) {
  const [ticket, setTicket] = useState<StaffTicketDetail | null>(null);
  const [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [priority, setPriority] = useState<StaffTicketPriority>("MEDIUM");
  const [status, setStatus] = useState<StaffTicketStatus | "">("");
  const [comment, setComment] = useState("");
  const [note, setNote] = useState("");
  const load = useCallback(async (): Promise<boolean> => {
    setLoading(true); setError("");
    try {
      const [detail, eligible] = await Promise.all([getStaffTicket(ticketId), getEligibleOwners()]);
      setTicket(detail); setOwners(eligible); setOwnerId(detail.owner?.id ?? ""); setPriority(detail.itPriority); setStatus("");
      return true;
    } catch (cause) {
      setTicket(null); setOwners([]); setSuccess("");
      setError(cause instanceof ApiError && cause.status === 403 ? "You are not permitted to view this ticket." : cause instanceof ApiError && cause.status === 404 ? "Ticket not found." : "Unable to load ticket detail. Please retry.");
      return false;
    }
    finally { setLoading(false); }
  }, [ticketId]);
  useEffect(() => { void load(); }, [load]);
  const save = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true); setError(""); setSuccess("");
    try { await action(); if (await load()) setSuccess(message); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 403) { setTicket(null); setOwners([]); }
      setError(cause instanceof ApiError && cause.status < 500 ? cause.message : "Unable to save. Please retry.");
    }
    finally { setBusy(false); }
  };
  const validText = (content: string, kind: string) => {
    const message = content.trim().length < 1 || content.trim().length > 2000 ? `${kind} must contain 1 to 2000 characters after trimming.` : "";
    setFieldErrors(previous => ({ ...previous, [kind]: message }));
    return !message;
  };
  return <div className="container-fluid px-0">
    <button className="btn btn-outline-primary-green mb-3" onClick={onBack}>Back to Ticket Queue</button>
    {loading && !ticket && <div role="status">Loading ticket detail...</div>}
    {error && <div role="alert" className="alert alert-danger">{error} <button className="btn btn-sm btn-outline-danger ms-2" disabled={busy || loading} onClick={() => void load()}>Retry</button></div>}
    {success && <div role="status" className="alert alert-success">{success}</div>}
    {ticket && <>
      <header className="zen-card p-4 mb-3"><h1 className="h3 text-primary-green">{ticket.ticketNumber}: {ticket.summary}</h1><p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</p></header>
      <div className="row g-3 mb-3"><section className="col-12 col-lg-6"><div className="zen-card p-4 h-100"><h2 className="h5">Ticket Information</h2><dl className="row mb-0">
        <dt className="col-5">Requester</dt><dd className="col-7 text-break">{ticket.requester.name} ({ticket.requester.email})</dd>
        <dt className="col-5">Category</dt><dd className="col-7">{ticket.category.name}</dd><dt className="col-5">Related System</dt><dd className="col-7">{ticket.relatedSystem.name}</dd>
        <dt className="col-5">Created</dt><dd className="col-7">{date(ticket.createdAt)}</dd><dt className="col-5">Updated</dt><dd className="col-7">{date(ticket.updatedAt)}</dd>
        <dt className="col-5">Problem Appears Resolved</dt><dd className="col-7">{ticket.problemAppearsResolvedAt ? date(ticket.problemAppearsResolvedAt) : "Not indicated"}</dd>
      </dl></div></section>
      <section className="col-12 col-lg-6"><div className="zen-card p-4 h-100"><h2 className="h5">Workflow</h2><p><strong>Requested Priority:</strong> {label(ticket.requestedPriority)}</p>
        <label className="form-label" htmlFor="staff-it-priority">IT Priority</label><div className="d-flex gap-2 flex-wrap mb-3"><select id="staff-it-priority" className="form-select flex-grow-1" style={{ minWidth: 160 }} value={priority} disabled={busy} onChange={e => setPriority(e.target.value as StaffTicketPriority)}>{(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map(v => <option key={v} value={v}>{label(v)}</option>)}</select><button className="btn btn-primary-green" disabled={busy || priority === ticket.itPriority} onClick={() => void save(() => updateStaffPriority(ticketId, priority), "IT Priority updated.")}>Save IT Priority</button></div>
        <p><strong>Current Status:</strong> {label(ticket.status)}</p><label className="form-label" htmlFor="staff-status">Next Status</label><div className="d-flex gap-2 flex-wrap"><select id="staff-status" className="form-select flex-grow-1" style={{ minWidth: 160 }} value={status} disabled={busy} onChange={e => setStatus(e.target.value as StaffTicketStatus)}><option value="">Choose status</option>{transitions[ticket.status].map(v => <option key={v} value={v}>{label(v)}</option>)}</select><button className="btn btn-primary-green" disabled={busy || !status} onClick={() => { if (status && window.confirm(`Change status to ${label(status)}?`)) void save(() => updateStaffStatus(ticketId, status), "Status updated."); }}>Update Status</button></div>
      </div></section></div>
      <section className="zen-card p-4 mb-3"><h2 className="h5">Ticket Ownership</h2><p>Current owner: <strong>{ticket.owner?.name ?? "Unassigned"}</strong></p><div className="d-flex gap-2 flex-wrap">{!ticket.owner && <button className="btn btn-primary-green" disabled={busy} onClick={() => void save(() => updateStaffOwner(ticketId, currentUser.id), "Ticket claimed.")}>Claim Ticket</button>}<label className="visually-hidden" htmlFor="staff-owner">Assign or reassign owner</label><select id="staff-owner" className="form-select flex-grow-1" style={{ minWidth: 180 }} value={ownerId} disabled={busy} onChange={e => setOwnerId(e.target.value)}><option value="">Unassigned</option>{owners.map(owner => <option key={owner.id} value={owner.id}>{owner.name} ({label(owner.role)})</option>)}</select><button className="btn btn-outline-primary-green" disabled={busy || ownerId === (ticket.owner?.id ?? "")} onClick={() => void save(() => updateStaffOwner(ticketId, ownerId || null), "Owner updated.")}>Save Owner</button></div></section>
      <section className="zen-card p-4 mb-3"><h2 className="h5">Attachments</h2>{ticket.attachments.length ? <ul>{ticket.attachments.map(a => <li className="text-break" key={a.id}><a href={`/api/staff/tickets/${encodeURIComponent(ticketId)}/attachments/${encodeURIComponent(a.id)}/download`}>{a.originalFilename}</a> ({Math.ceil(a.sizeBytes / 1024)} KB)</li>)}</ul> : <p>No attachments.</p>}</section>
      <div className="row g-3"><section className="col-12 col-lg-6"><div className="zen-card p-4 h-100"><h2 className="h5">Public Comments</h2><p className="text-secondary">Visible to the Requester. Do not include private staff information.</p>{ticket.publicComments.map(item => <article className="border-top py-2" key={item.id}><strong>{item.author.name}</strong> <time className="text-secondary small" dateTime={item.createdAt}>{date(item.createdAt)}</time><p className="text-break mb-0" style={{ whiteSpace: "pre-wrap" }}>{item.content}</p></article>)}<FormField id="staff-comment" label="Public Comment" className="mt-3" error={fieldErrors.Comment}><textarea className="form-control" maxLength={2000} value={comment} onChange={e => { setComment(e.target.value); setFieldErrors(previous => ({ ...previous, Comment: "" })); }} /></FormField><button className="btn btn-primary-green mt-2" disabled={busy} onClick={() => { if (validText(comment, "Comment")) void save(async () => { await postComment(ticketId, comment); setComment(""); }, "Public Comment added."); }}>Post Public Comment</button></div></section>
      <section className="col-12 col-lg-6"><div className="zen-card p-4 h-100 border border-warning"><h2 className="h5">Internal Notes</h2><p className="text-secondary">Private to IT Staff and Administrators. The Requester cannot see these notes.</p>{ticket.internalNotes.map(item => <article className="border-top py-2" key={item.id}><strong>{item.author.name}</strong> <time className="text-secondary small" dateTime={item.createdAt}>{date(item.createdAt)}</time><p className="text-break mb-0" style={{ whiteSpace: "pre-wrap" }}>{item.content}</p></article>)}<FormField id="staff-note" label="Internal Note" className="mt-3" error={fieldErrors.Note}><textarea className="form-control" maxLength={2000} value={note} onChange={e => { setNote(e.target.value); setFieldErrors(previous => ({ ...previous, Note: "" })); }} /></FormField><button className="btn btn-outline-primary-green mt-2" disabled={busy} onClick={() => { if (validText(note, "Note")) void save(async () => { await postInternalNote(ticketId, note); setNote(""); }, "Internal Note added."); }}>Add Internal Note</button></div></section></div>
    </>}
  </div>;
}
