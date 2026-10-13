import { useCallback, useEffect, useRef, useState } from "react";
import { ActionContent, ActionHistory, ActionTaken, ApiError, AuthUser, CreateActionInput, createAction, EligibleOwner, getActions, getEligibleOwners, updateAction } from "../api.js";
import FormField from "./common/FormField.js";
import ErrorAlert from "./common/ErrorAlert.js";
import StatusBadge from "./common/StatusBadge.js";

type Draft = ActionContent & { assigneeId: string };
const blank = (id: string): Draft => ({ actionDescription: "", actionResult: "", followUpRequired: false, followUpNote: "", attachmentNotes: "", assigneeId: id });
const eligible = (a: ActionTaken) => a.assignee.isActive && ["IT_STAFF", "ADMINISTRATOR"].includes(a.assignee.role);
const activeStatuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];
const textFields = ["actionDescription", "actionResult", "followUpNote", "attachmentNotes"] as const;
const labels = { actionDescription: "Action Description", actionResult: "Result", followUpNote: "Follow-up Note", attachmentNotes: "Attachment Notes" };
type HistoryQuery = { page?: number; pageSize: 10 | 20 | 50; focusActionId?: string };
type ActionsProps = {
  ticketId: string; ticketNumber?: string; ticketStatus?: string; currentUser?: AuthUser; onSaved?: () => Promise<boolean>; onRefreshTicket?: () => Promise<boolean>; onAccessLost?: () => void;
};
const normalized = (draft: Draft): Omit<CreateActionInput, "clientRequestId"> => ({
  actionDescription: draft.actionDescription.trim(), actionResult: draft.actionResult.trim(),
  followUpRequired: draft.followUpRequired, followUpNote: draft.followUpNote?.trim() || null,
  attachmentNotes: draft.attachmentNotes?.trim() || null, assigneeId: draft.assigneeId,
});

export default function ActionsTaken(props: ActionsProps) {
  return <ActionsTakenContent key={props.ticketId + ":" + (props.currentUser?.id ?? "requester") + ":" + (props.currentUser?.role ?? "REQUESTER")} {...props}/>;
}
function ActionsTakenContent({ ticketId, ticketNumber, ticketStatus, currentUser, onSaved, onRefreshTicket, onAccessLost }: ActionsProps) {
  const staff = !!currentUser && currentUser.role !== "REQUESTER";
  const activeTicket = activeStatuses.includes(ticketStatus ?? "");
  const [history, setHistory] = useState<ActionHistory | null>(null);
  const [owners, setOwners] = useState<EligibleOwner[]>([]);
  const [ownerError, setOwnerError] = useState(false);
  const [ownerLoading, setOwnerLoading] = useState(staff);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(20);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editing, setEditing] = useState<ActionTaken | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank(currentUser?.id ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [reviewed, setReviewed] = useState<ActionTaken | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [workflowConflict, setWorkflowConflict] = useState(false);
  const [workflowReview, setWorkflowReview] = useState(false);
  const [failedHistory, setFailedHistory] = useState<{ ticketId: string; staff: boolean; query: HistoryQuery } | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const requestKey = useRef<{ fingerprint: string; input: CreateActionInput; uncertain: boolean } | null>(null);
  const generation = useRef(0);
  const ownerGeneration = useRef(0);
  const lifetime = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<string | null>(null);
  const [hash, setHash] = useState(window.location.hash);
  const focusId = staff && hash.startsWith("#action-") ? hash.slice(8) : undefined;
  const clearingCompletedFollowUp = !!editing && editing !== "new" && editing.status === "COMPLETED" && editing.followUpRequired && !draft.followUpRequired;
  const noteRequired = draft.followUpRequired || clearingCompletedFollowUp;
  const exactCreateRetry = editing === "new" && requestKey.current?.uncertain === true && requestKey.current.fingerprint === JSON.stringify(normalized(draft));
  useEffect(() => {
    const changed = () => setHash(window.location.hash);
    window.addEventListener("hashchange", changed); window.addEventListener("popstate", changed);
    return () => { window.removeEventListener("hashchange", changed); window.removeEventListener("popstate", changed); };
  }, []);
  const fail = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403 || cause.code === "PASSWORD_CHANGE_REQUIRED")) {
      setDenied(true); setHistory(null); setEditing(null); setDraft(blank("")); setOwners([]); requestKey.current = null;
      ++generation.current; ++ownerGeneration.current; ++lifetime.current; setFailedHistory(null);
      pending.current = false; setLoading(false); setBusy(false); setOwnerLoading(false); setSuccess("");
      setError("Actions Taken are unavailable for your session or role."); onAccessLost?.(); return;
    }
    if (cause instanceof ApiError && cause.status === 404) setHistory(null);
    setError(cause instanceof ApiError && cause.status === 404 ? "Ticket or Action not found or unavailable." :
      cause instanceof ApiError && cause.code === "TICKET_WORKFLOW_CONFLICT" ? "This change requires the Ticket to be reopened. Review its current status." :
      cause instanceof ApiError && cause.code === "IDEMPOTENCY_CONFLICT" ? "This request ID was already used for different content. Review before starting a new Action." :
      cause instanceof ApiError && cause.status < 500 ? cause.message : "Unable to complete the request. Check your connection and retry.");
  }, [onAccessLost]);
  const load = useCallback(async (page?: number, focus?: string): Promise<boolean> => {
    return loadHistory({ pageSize, ...(focus ? { focusActionId: focus } : { page: page ?? 1 }) });
  }, [pageSize, ticketId, staff, fail]);
  async function loadHistory(query: HistoryQuery): Promise<boolean> {
    const token = ++generation.current;
    setLoading(true); setError(""); setFailedHistory(null);
    try {
      const result = await getActions(ticketId, staff, query);
      if (token !== generation.current) return false;
      setHistory(result); return true;
    } catch (cause) {
      if (token === generation.current) {
        if (!(cause instanceof ApiError && ([401, 403].includes(cause.status) || cause.code === "PASSWORD_CHANGE_REQUIRED"))) setFailedHistory({ ticketId, staff, query });
        fail(cause);
      }
      return false;
    }
    finally { if (token === generation.current) setLoading(false); }
  }
  const loadOwners = useCallback(async () => {
    const token = ++ownerGeneration.current;
    setOwnerLoading(true); setOwnerError(false);
    try { const result = await getEligibleOwners(); if (mounted.current && token === ownerGeneration.current) setOwners(result); }
    catch (cause) { if (!mounted.current || token !== ownerGeneration.current) return; setOwnerError(true); if (cause instanceof ApiError && [401, 403].includes(cause.status)) fail(cause); }
    finally { if (mounted.current && token === ownerGeneration.current) setOwnerLoading(false); }
  }, [fail]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++generation.current; ++ownerGeneration.current; ++lifetime.current; };
  }, []);
  useEffect(() => {
    void load(undefined, focusId);
    if (staff) void loadOwners();
    return () => { ++generation.current; ++ownerGeneration.current; };
  }, [load, staff, loadOwners, focusId]);
  useEffect(() => {
    if (history && focusId) document.getElementById("action-" + focusId)?.focus();
  }, [history, focusId]);
  useEffect(() => {
    if (editing) form.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    else if (!busy && returnFocus.current) {
      const target = returnFocus.current;
      returnFocus.current = null;
      (document.getElementById(target) ?? addButton.current)?.focus();
    }
  }, [editing, busy]);
  const open = (action: ActionTaken | "new") => {
    setEditing(action); setCancelling(false); setErrors({}); setError(""); setSuccess(""); setConflict(false); setReviewed(null); setWorkflowConflict(false); setWorkflowReview(false); requestKey.current = null;
    setDraft(action === "new" ? blank(currentUser?.id ?? "") : { actionDescription: action.actionDescription, actionResult: action.actionResult, followUpRequired: action.followUpRequired, followUpNote: action.followUpNote ?? "", attachmentNotes: action.attachmentNotes ?? "", assigneeId: action.assignee.id });
  };
  const close = () => {
    returnFocus.current = editing === "new" ? "actions-add" : editing ? "action-" + editing.id : "actions-add";
    setEditing(null); setConflict(false); setReviewed(null); requestKey.current = null;
  };
  const validate = () => {
    const fields: Record<string, string> = {};
    for (const key of textFields) {
      const value = (draft[key] ?? "").trim();
      if (value.length > 2000 || (["actionDescription", "actionResult"].includes(key) && !value)) fields[key] = "Enter 1 to 2000 characters after trimming.";
      if (value.includes("\u0000")) fields[key] = "NUL characters are not permitted.";
    }
    if (noteRequired && !draft.followUpNote?.trim()) fields.followUpNote = clearingCompletedFollowUp ? "Enter a new explanation of work verified or an erroneous follow-up flag." : "Enter a follow-up note when follow-up is required.";
    if (clearingCompletedFollowUp &&
      (!draft.followUpNote?.trim() || draft.followUpNote.trim() === editing.followUpNote?.trim())) fields.followUpNote = "Enter a new explanation of work verified or an erroneous follow-up flag.";
    if (editing === "new" && !exactCreateRetry && !owners.some(o => o.id === draft.assigneeId)) fields.assigneeId = "Select an eligible active IT Staff or Administrator.";
    if (editing && editing !== "new" && draft.assigneeId !== editing.assignee.id && !owners.some(o => o.id === draft.assigneeId)) fields.assigneeId = "Select an eligible active IT Staff or Administrator.";
    setErrors(fields);
    if (Object.keys(fields).length) requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    return !Object.keys(fields).length;
  };
  const save = async (status?: "COMPLETED" | "CANCELLED") => {
    if (pending.current || !editing || conflict || workflowConflict || !validate()) return;
    if (status && !window.confirm(`${status === "COMPLETED" ? "Complete" : "Cancel"} Action on ${ticketNumber ?? ticketId}? Result: ${draft.actionResult.trim()}. ${status === "COMPLETED" ? "Completing" : "Cancelling"} as ${currentUser?.name}.`)) return;
    pending.current = true; setBusy(true); setError(""); setSuccess("");
    const token = lifetime.current;
    const content: ActionContent = { ...draft, actionDescription: draft.actionDescription.trim(), actionResult: draft.actionResult.trim(), followUpNote: draft.followUpNote?.trim() || null, attachmentNotes: draft.attachmentNotes?.trim() || null };
    // Construct a whitelist: identity, assignee and status are never part of content.
    const { actionDescription, actionResult, followUpRequired, followUpNote, attachmentNotes } = content;
    const values = { actionDescription, actionResult, followUpRequired, followUpNote, attachmentNotes };
    try {
      if (editing === "new") {
        const payload = normalized(draft);
        const fingerprint = JSON.stringify(payload);
        if (requestKey.current && requestKey.current.fingerprint !== fingerprint && !window.confirm("The earlier create may have succeeded. Changed content starts a new logical Action with a new request ID. Continue?")) return;
        if (!requestKey.current || requestKey.current.fingerprint !== fingerprint) requestKey.current = { fingerprint, input: { ...payload, clientRequestId: crypto.randomUUID() }, uncertain: true };
        requestKey.current.uncertain = true;
        await createAction(ticketId, { ...requestKey.current.input });
      } else {
        await updateAction(ticketId, editing.id, { ...values, expectedVersion: editing.version,
          ...(draft.assigneeId !== editing.assignee.id && editing.status === "PENDING" && activeTicket ? { assigneeId: draft.assigneeId } : {}),
          ...(status ? { status } : {}) });
      }
      if (token !== lifetime.current) return;
      close(); setSuccess(status === "COMPLETED" ? "Action completed." : status === "CANCELLED" ? "Action cancelled." : "Action saved.");
      const refreshed = await load(history?.meta.page);
      if (token !== lifetime.current) return;
      const detailRefreshed = onSaved ? await onSaved() : true;
      if (token === lifetime.current && (!refreshed || !detailRefreshed)) setSuccess("Saved; unable to refresh. Retry loading the confirmed records.");
    } catch (cause) {
      if (token !== lifetime.current) return;
      if (editing === "new" && requestKey.current) requestKey.current.uncertain = !(cause instanceof ApiError) || cause.status >= 500;
      if (cause instanceof ApiError) {
        setErrors(cause.fields);
        if (Object.keys(cause.fields).length) requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        if (cause.code === "CONFLICT" || cause.code === "ACTION_STATE_CONFLICT") {
          setConflict(true); setError("The Action changed. Your draft is preserved. Reload for review before an explicit retry.");
        } else { if (cause.code === "TICKET_WORKFLOW_CONFLICT") { setWorkflowConflict(true); setWorkflowReview(false); } fail(cause); }
      } else fail(cause);
    } finally { if (token === lifetime.current) { pending.current = false; setBusy(false); } }
  };
  const refreshWorkflow = async () => {
    if (pending.current || !onRefreshTicket) return;
    const token = lifetime.current;
    pending.current = true; setBusy(true);
    try {
      const refreshed = await onRefreshTicket();
      if (token !== lifetime.current) return;
      if (refreshed) {
        await load(history?.meta.page);
        if (token === lifetime.current) { setWorkflowConflict(false); setWorkflowReview(true); }
      }
    } finally { if (token === lifetime.current) { pending.current = false; setBusy(false); } }
  };
  const reloadForReview = async () => {
    if (!editing || editing === "new") return;
    const id = editing.id;
    const token = ++generation.current;
    setLoading(true);
    try { const result = await getActions(ticketId, true, { pageSize, focusActionId: id }); if (token === generation.current) { setHistory(result); setReviewed(result.data.find(a => a.id === id) ?? null); } }
    catch (cause) { if (token === generation.current) fail(cause); }
    finally { if (token === generation.current) setLoading(false); }
  };
  return <section className="zen-card p-4 mb-3" aria-labelledby="actions-title" aria-busy={loading || busy}>
    <h2 id="actions-title" tabIndex={-1} className="h5">Actions Taken</h2>
    <p>{staff ? "Actions Taken are visible to the Requester. Use Internal Notes for private staff information." : "Shared work records for your Ticket."}</p>
    {error && <ErrorAlert title="Actions Taken unavailable" message={error} onRetry={!denied && !conflict && !busy && !loading && failedHistory ? () => { if (failedHistory.ticketId === ticketId && failedHistory.staff === staff) void loadHistory(failedHistory.query); } : undefined} />}
    {success && <p role="status" className="alert alert-success">{success}</p>}
    {loading && <p role="status">Loading Actions Taken...</p>}
    {!denied && <>
      {staff && !editing && <><button id="actions-add" ref={addButton} className="btn btn-primary-green mb-2" disabled={!activeTicket || loading || busy} onClick={() => open("new")}>Add Action</button>{!activeTicket && <p>Reopen this Ticket before adding or reassigning pending work.</p>}</>}
      {ownerError && staff && <p role="alert">Unable to load eligible assignees. <button className="btn btn-outline-primary-green" onClick={() => void loadOwners()}>Retry assignees</button></p>}
      {ownerLoading && staff && <p role="status">Loading eligible assignees...</p>}
      {staff && editing === "new" && !ownerLoading && !ownerError && !owners.length && <p>No eligible active IT Staff or Administrators are available. Creation requires an eligible Action Assignee.</p>}
      {workflowConflict && onRefreshTicket && <button className="btn btn-outline-primary-green mb-3" disabled={busy || loading} onClick={() => void refreshWorkflow()}>Refresh Ticket and Actions for review</button>}
      {workflowReview && <p role="status">Current Ticket status: {ticketStatus}. Your Action draft is preserved. Review the current state before an explicit retry.</p>}
      {history && !history.data.length && <p>No actions recorded for this ticket.</p>}
      {history?.data.map(action => <article key={action.id} id={"action-" + action.id} tabIndex={-1} className={`border rounded p-3 mb-3 text-break ${focusId === action.id ? "border-success" : ""}`}>
        <h3 className="h6" style={{ whiteSpace: "pre-wrap" }}>{action.actionDescription}</h3>
        <p><StatusBadge label={action.status} variant={action.status === "PENDING" ? "warning" : action.status === "COMPLETED" ? "success" : "neutral"}/></p>
        <p>Performed By (original record): <strong>{action.performedBy.name}</strong> ({action.performedBy.role})</p>
        <p>Action Assignee: <strong>{action.assignee.name}</strong> ({action.assignee.role}){!eligible(action) && " — Inactive or no longer eligible; reassign before completion."}</p>
        <p>Action Date/Time: <time dateTime={action.actionDateTime}>{new Date(action.actionDateTime).toLocaleString()}</time></p>
        <details><summary>View Action details</summary><dl>
          <dt>{action.status === "CANCELLED" ? "Result / cancellation reason" : "Result"}</dt><dd style={{ whiteSpace: "pre-wrap" }}>{action.actionResult}</dd>
          <dt>Follow-up Required?</dt><dd>{action.followUpRequired ? "Yes" : "No"}{action.status === "CANCELLED" && " — Cancelled — follow-up flag retained for history"}</dd>
          <dt>Follow-up Note</dt><dd style={{ whiteSpace: "pre-wrap" }}>{action.followUpNote ?? "None"}</dd>
          <dt>Attachment Notes</dt><dd style={{ whiteSpace: "pre-wrap" }}>{action.attachmentNotes ?? "None"}</dd>
          <dt>Created</dt><dd><time dateTime={action.createdAt}>{new Date(action.createdAt).toLocaleString()}</time></dd>
          <dt>Updated / version</dt><dd><time dateTime={action.updatedAt}>{new Date(action.updatedAt).toLocaleString()}</time> / {action.version}</dd>
        </dl></details>
        {staff && <button className="btn btn-outline-primary-green mt-2" disabled={busy || !!editing} onClick={() => open(action)} aria-label={`Edit Action: ${action.actionDescription}`}>Edit Action</button>}
      </article>)}
      {history && <nav aria-label="Actions Taken pagination" className="d-flex gap-2 flex-wrap align-items-center mb-3">
        <label htmlFor="actions-page-size">Actions per page</label><select id="actions-page-size" value={pageSize} disabled={loading || busy} onChange={e => setPageSize(Number(e.target.value) as 10 | 20 | 50)}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select>
        <span>{history.meta.totalPages ? `Page ${history.meta.page} of ${history.meta.totalPages} (${history.meta.totalItems} Actions)` : "0 Actions"}</span>
        <button className="btn btn-outline-primary-green" disabled={loading || busy || history.meta.page <= 1} onClick={() => void load(history.meta.page - 1)}>Previous Actions</button>
        <button className="btn btn-outline-primary-green" disabled={loading || busy || history.meta.page >= history.meta.totalPages} onClick={() => void load(history.meta.page + 1)}>Next Actions</button>
      </nav>}
      {editing && staff && <form ref={form} noValidate onSubmit={e => { e.preventDefault(); void save(cancelling ? "CANCELLED" : undefined); }}>
        <h3 className="h6">{editing === "new" ? "New Action — PENDING" : `Edit Action — ${editing.status}`}</h3>
        <p>Action Date/Time: {editing === "new" ? "Recorded automatically when saved" : new Date(editing.actionDateTime).toLocaleString()}</p>
        <p>Performed By (original record): {editing === "new" ? currentUser?.name : editing.performedBy.name}. Who originally recorded this action; completion may be by another staff member.</p>
        <fieldset disabled={busy}>
          {cancelling && <p>Enter the cancellation reason in Result, then confirm Cancel action.</p>}
          {textFields.map(key => <FormField key={key} id={"action-" + key} label={labels[key]} required={key === "actionDescription" || key === "actionResult" || key === "followUpNote" && noteRequired} error={errors[key]} helperText={key === "attachmentNotes" ? "Shared text naming relevant files; this does not upload files." : key === "followUpNote" && clearingCompletedFollowUp ? "A new explanation of work addressed/verified or an erroneous follow-up flag is required, different from the previous note." : undefined}>
            <textarea className="form-control" required={key === "actionDescription" || key === "actionResult" || key === "followUpNote" && noteRequired} aria-required={key === "actionDescription" || key === "actionResult" || key === "followUpNote" && noteRequired} value={draft[key] ?? ""} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setErrors({ ...errors, [key]: "" }); }} />
          </FormField>)}
          <FormField id="action-followUpRequired" label="Follow-up Required?" error={errors.followUpRequired}><input type="checkbox" className="form-check-input" checked={draft.followUpRequired} onChange={e => setDraft({ ...draft, followUpRequired: e.target.checked })}/></FormField>
          {editing === "new" || editing.status === "PENDING" && activeTicket ? <FormField id="action-assigneeId" label="Action Assignee" required error={errors.assigneeId} helperText="Designated worker, separate from the Primary Ticket Owner and original performer.">
            <select className="form-select" required value={draft.assigneeId} onChange={e => { setDraft({ ...draft, assigneeId: e.target.value }); setErrors({ ...errors, assigneeId: "" }); }}>
              <option value="" disabled>Choose eligible assignee</option>
              {!owners.some(o => o.id === draft.assigneeId) && draft.assigneeId && <option value={draft.assigneeId} disabled>Current assignee unavailable — choose an eligible replacement</option>}
              {owners.map(o => <option key={o.id} value={o.id}>{o.name} ({o.role})</option>)}
            </select>
          </FormField> : <p>Action Assignee: {editing.assignee.name}. Assignment is read-only for this Action or Ticket status.</p>}
          {errors.assigneeId && editing !== "new" && (editing.status !== "PENDING" || !activeTicket) && <p role="alert">{errors.assigneeId}</p>}
          {editing !== "new" && editing.status === "COMPLETED" && editing.followUpRequired && !draft.followUpRequired && <p>Replace Follow-up Note with a new explanation of work addressed/verified or correction of an erroneous flag.</p>}
        </fieldset>
        {conflict && <div role="alert"><button type="button" className="btn btn-outline-primary-green" disabled={loading || busy} onClick={() => void reloadForReview()}>Reload for review</button>
          {reviewed && <><p>Current server version {reviewed.version}: {reviewed.status}; {reviewed.actionDescription}; Result: {reviewed.actionResult}; Assignee: {reviewed.assignee.name}; Follow-up: {reviewed.followUpRequired ? "Yes" : "No"}; Note: {reviewed.followUpNote ?? "None"}; Attachment Notes: {reviewed.attachmentNotes ?? "None"}. Review these values against your retained draft.</p><button type="button" className="btn btn-outline-primary-green" onClick={() => { setEditing(reviewed); if (reviewed.status !== "PENDING") setCancelling(false); setDraft(d => ({ ...d, assigneeId: reviewed.status !== "PENDING" || !activeTicket ? reviewed.assignee.id : d.assigneeId })); setConflict(false); setReviewed(null); setError(""); }}>Use current version for explicit retry</button></>}
        </div>}
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-primary-green" disabled={busy || conflict || workflowConflict || cancelling || editing === "new" && !exactCreateRetry && (!activeTicket || ownerLoading || ownerError || !owners.length)}>{busy ? "Saving..." : "Save Action"}</button>
          {editing !== "new" && editing.status === "PENDING" && <><button type="button" className="btn btn-primary-green" disabled={busy || conflict || workflowConflict || cancelling || !(draft.assigneeId !== editing.assignee.id ? owners.some(o => o.id === draft.assigneeId) : eligible(editing))} onClick={() => void save("COMPLETED")}>Complete action</button>
            <button type="button" className="btn btn-outline-danger" disabled={busy || conflict || workflowConflict} onClick={() => { if (cancelling) void save("CANCELLED"); else { setCancelling(true); setDraft({ ...draft, actionResult: "" }); requestAnimationFrame(() => document.getElementById("action-actionResult")?.focus()); } }}>Cancel action</button></>}
          <button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => { if (window.confirm("Discard unsaved Action changes?")) close(); }}>Discard changes</button>
        </div>
      </form>}
    </>}
  </section>;
}
