import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ApiError, getRequesterDashboard, requesterStatusFromDashboard, type DashboardTicketStatus, type AuthUser, type RequesterDashboardResponse } from "../api.js";
import ErrorAlert from "./common/ErrorAlert.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import StatusBadge from "./common/StatusBadge.js";

const label = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
export default function RequesterDashboardScreen({ currentUser, onNavigate }: { currentUser: AuthUser; onNavigate: (url: string) => void }) {
  const identity = currentUser.id + ":" + currentUser.role;
  const accessAllowed = currentUser.role === "REQUESTER" && !currentUser.mustChangePassword && currentUser.isActive;
  const [result, setResult] = useState<{ identity: string; response: RequesterDashboardResponse } | null>(null);
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
      const next = await getRequesterDashboard({ signal: controller.signal, isCurrent: () => token === generation.current && currentAccess.current.identity === identity && currentAccess.current.accessAllowed });
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
  return <section className="requester-dashboard-screen" aria-label="Requester Dashboard" aria-busy={loading}>
    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
      <div><h1 ref={dashboardHeading} tabIndex={-1} className="h3 text-primary-green">Requester Dashboard</h1><p>Your ticket overview: My Tickets</p>
        <p className="small mb-0">{response ? <>Last successful refresh: <time dateTime={response.meta.generatedAt}>{new Date(response.meta.generatedAt).toLocaleString()}</time></> : "No successful refresh yet."}</p></div>
      {!denied && accessAllowed && <button ref={refreshButton} className="btn btn-primary-green" disabled={loading} onClick={() => void load()}>Refresh</button>}
    </div>
    {error && <div ref={errorRegion}><ErrorAlert message={error} onRetry={denied || loading ? undefined : () => void load()}/></div>}
    {loading && <LoadingSpinner message={response ? "Refreshing dashboard..." : "Loading dashboard..."}/>}
    {response && !denied && <>
      {error && <p role="status">Showing previously loaded data from the last successful refresh.</p>}
      <p className="text-secondary">Only your Tickets. Active means New, Open, In Progress, Waiting for Requester and Reopened.</p>
      <div className="row g-3 mb-4">
        {metric("Total My Tickets", response.data.totalTickets, "/tickets")}
        {metric("Active Tickets", response.data.activeTickets, "/tickets?statusGroup=active")}
        {metric("Waiting for you", response.data.waitingForRequesterTickets, "/tickets?currentStatus=WaitingForRequester")}
        {metric("Resolved Tickets", response.data.resolvedTickets, "/tickets?currentStatus=Resolved")}
      </div>
      {response.data.totalTickets === 0 && <p>No Tickets submitted yet. {link("/tickets/new", "Create Ticket")}</p>}
      <h2 className="h5">Tickets by status</h2>
      <div className="row g-3 mb-4">{Object.entries(response.data.byStatus).map(([status, count]) => metric(label(status), count, "/tickets?currentStatus=" + requesterStatusFromDashboard[status as DashboardTicketStatus]))}</div>
      {([ ["Recently Updated Tickets", response.data.recentTickets, "/tickets?sortBy=recentlyUpdated", "View all recently updated Tickets"],
        ["Recently Updated Resolved Tickets", response.data.resolvedTicketsRecent, "/tickets?currentStatus=Resolved&sortBy=recentlyUpdated", "View all recently updated resolved Tickets"] ] as const).map(([heading, tickets, href, title]) => <section key={heading} aria-label={heading}>
        <h2 className="h5">{heading}</h2>{link(href, title)}
        {!tickets.length && <p className="mt-3">{heading === "Recently Updated Tickets" ? "No recent Tickets." : "No recently updated resolved Tickets."}</p>}
        <ul className="list-unstyled mt-3">{tickets.map(ticket => <li className="zen-card p-3 mb-3" key={ticket.id}>
          {link("/tickets/" + encodeURIComponent(ticket.id), ticket.ticketNumber + ": " + ticket.summary)}
          <div className="mt-2"><StatusBadge label={label(ticket.status)}/></div>
          <time dateTime={ticket.updatedAt}>{new Date(ticket.updatedAt).toLocaleString()}</time>
        </li>)}</ul>
      </section>)}
    </>}
  </section>;
}
