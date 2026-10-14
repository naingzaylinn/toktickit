import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ApiError, getStaffDashboard, type AuthUser, type StaffDashboardResponse } from "../api.js";
import ErrorAlert from "./common/ErrorAlert.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import StatusBadge from "./common/StatusBadge.js";

const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
export default function StaffDashboardScreen({ currentUser, onNavigate }: { currentUser: AuthUser; onNavigate: (url: string) => void }) {
  const identity = currentUser.id + ":" + currentUser.role;
  const accessAllowed = ["IT_STAFF", "ADMINISTRATOR"].includes(currentUser.role) && currentUser.isActive && !currentUser.mustChangePassword;
  const [result, setResult] = useState<{ identity: string; response: StaffDashboardResponse } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const generation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const currentAccess = useRef({ identity, accessAllowed });
  currentAccess.current = { identity, accessAllowed };
  const refreshButton = useRef<HTMLButtonElement>(null);
  const errorRegion = useRef<HTMLDivElement>(null);
  const dashboardHeading = useRef<HTMLHeadingElement>(null);
  const restoreRefreshFocus = useRef(false);
  const response = accessAllowed && result?.identity === identity ? result.response : null;
  const load = async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const token = ++generation.current;
    if (!accessAllowed) { setResult(null); setDenied(true); setLoading(false); setError("The dashboard is unavailable for your session or role."); return; }
    restoreRefreshFocus.current = document.activeElement === refreshButton.current ||
      !!errorRegion.current?.contains(document.activeElement);
    setLoading(true); setError("");
    try {
      const next = await getStaffDashboard({ signal: controller.signal, isCurrent: () => token === generation.current && currentAccess.current.identity === identity && currentAccess.current.accessAllowed });
      if (token === generation.current) setResult({ identity, response: next });
    } catch (cause) {
      if (token !== generation.current) return;
      if (cause instanceof ApiError && ([401, 403].includes(cause.status) || cause.code === "PASSWORD_CHANGE_REQUIRED")) {
        ++generation.current; setResult(null); setDenied(true); setLoading(false);
        setError("The dashboard is unavailable for your session or role.");
      } else setError("Unable to refresh the dashboard. Please try again.");
    } finally { if (token === generation.current) setLoading(false); }
  };
  useEffect(() => {
    setResult(null); setDenied(false);
    void load();
    const clear = () => { pending.current?.abort(); ++generation.current; setResult(null); setDenied(true); setLoading(false); setError("The dashboard is unavailable for your session or role."); };
    window.addEventListener("session-access-changed", clear);
    return () => { pending.current?.abort(); ++generation.current; window.removeEventListener("session-access-changed", clear); };
  }, [identity, accessAllowed]);
  useEffect(() => {
    // Refresh is disabled while busy; keep focus on the stable heading until
    // the request settles, unless the user has moved to another control.
    if (loading && !denied && restoreRefreshFocus.current && document.activeElement === document.body) dashboardHeading.current?.focus();
    if (!loading && !denied && restoreRefreshFocus.current) {
      restoreRefreshFocus.current = false;
      if (document.activeElement === document.body || document.activeElement === dashboardHeading.current || document.activeElement === refreshButton.current) refreshButton.current?.focus();
    }
  }, [loading, denied]);
  const link = (href: string, children: React.ReactNode, className = "") => <a href={href} className={className} onClick={(e: MouseEvent<HTMLAnchorElement>) => {
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); onNavigate(href); }
  }}>{children}</a>;
  const metric = (name: string, count: number, href: string) => <div className="col-12 col-md-6 col-xl-3" key={name}>
    {link(href, <><span>{name}</span><strong className="d-block fs-2">{count}</strong></>, "zen-card p-3 d-block h-100 text-primary-green dashboard-metric")}
  </div>;
  return <section className="staff-dashboard-screen" aria-label="IT Staff Dashboard" aria-busy={loading}>
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div><h1 ref={dashboardHeading} tabIndex={-1} className="h3 text-primary-green">IT Staff Dashboard</h1><p>Operational overview</p>
        <p className="small mb-0">{response ? <>Last successful refresh: <time dateTime={response.meta.generatedAt}>{new Date(response.meta.generatedAt).toLocaleString()}</time></> : "No successful refresh yet."}</p></div>
      {!denied && <button ref={refreshButton} className="btn btn-primary-green" disabled={loading} onClick={() => void load()}>Refresh</button>}
    </div>
    {error && <div ref={errorRegion}><ErrorAlert message={error} onRetry={denied || loading ? undefined : () => void load()}/></div>}
    {loading && <LoadingSpinner message={response ? "Refreshing dashboard..." : "Loading dashboard..."}/>}
    {response && !denied && <>
      {error && <p role="status">Showing previously loaded data from the last successful refresh.</p>}
      <p className="text-secondary">Shared operational counts cover all Tickets. My Active Tickets counts your primary ownership.</p>
      <div className="row g-3 mb-4">
        {metric("Total Tickets", response.data.totalTickets, "/staff/tickets")}
        {metric("Active Tickets", response.data.activeTickets, "/staff/tickets?statusGroup=active")}
        {metric("Unassigned Active Tickets", response.data.unassignedActiveTickets, "/staff/tickets?statusGroup=active&owner=unassigned")}
        {metric("My Active Tickets", response.data.myActiveTickets, "/staff/tickets?statusGroup=active&owner=" + encodeURIComponent(currentUser.id))}
      </div>
      <h2 className="h5">Tickets by status</h2><div className="row g-3 mb-4">{Object.entries(response.data.byStatus).map(([status, count]) => metric(label(status), count, "/staff/tickets?status=" + status))}</div>
      <h2 className="h5">Active Tickets by IT Priority</h2><p>Active means New, Open, In Progress, Waiting for Requester and Reopened.</p>
      <div className="row g-3 mb-4">{Object.entries(response.data.activeByItPriority).map(([priority, count]) => metric(label(priority) + " IT Priority", count, "/staff/tickets?statusGroup=active&itPriority=" + priority))}</div>
      <h2 className="h5">Recent Tickets</h2>{link("/staff/tickets?sort=updatedAt&order=desc", "View all recent Tickets")}
      {!response.data.recentTickets.length && <p className="mt-3">No recent Tickets. Open the Ticket Queue to view available work.</p>}
      <ul className="list-unstyled mt-3">{response.data.recentTickets.map(ticket => <li className="zen-card p-3 mb-3" key={ticket.id}>
        {link("/staff/tickets/" + encodeURIComponent(ticket.id), ticket.ticketNumber + ": " + ticket.summary)}
        <div className="d-flex flex-wrap gap-2 mt-2"><StatusBadge label={label(ticket.status)}/><span>IT Priority: {label(ticket.itPriority)}</span><span>Owner: {ticket.owner?.name ?? "Unassigned"}</span></div>
        <time dateTime={ticket.updatedAt}>{new Date(ticket.updatedAt).toLocaleString()}</time>
      </li>)}</ul>
      <h2 className="h5">Actions originally recorded by you</h2><p>Actions originally recorded by you: {response.data.myActions.totalItems}</p>
      <p className="text-secondary">Original performer, across all Action and Ticket states; current assignee may differ.</p>
      {!response.data.myActions.items.length && <p>No Actions originally recorded by you.</p>}
      <ul className="list-unstyled">{response.data.myActions.items.map(action => <li key={action.id} className="zen-card p-3 mb-3">
        {link("/staff/tickets/" + encodeURIComponent(action.ticketId) + "#action-" + encodeURIComponent(action.id), action.ticketNumber + ": " + action.actionDescription)}
        <div className="d-flex flex-wrap gap-2 mt-2"><StatusBadge label={label(action.status)}/><span>Assignee: {action.assignee.name}{!action.assignee.isActive && " (inactive)"}</span><span>Follow-up: {action.followUpRequired ? "Required" : "Not required"}</span></div>
        <time dateTime={action.actionDateTime}>{new Date(action.actionDateTime).toLocaleString()}</time>
      </li>)}</ul>
    </>}
  </section>;
}
