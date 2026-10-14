import { useEffect, useRef, useState } from "react";
import { AuthUser, ApiError, getCurrentUser, logout } from "./api.js";
import AppShell from "./components/AppShell.js";
import AuthScreen from "./components/AuthScreen.js";
import SystemDiagnostic from "./components/SystemDiagnostic.js";
import CreateTicketScreen from "./components/CreateTicketScreen.js";
import MyTicketsScreen from "./components/MyTicketsScreen.js";
import TicketDetailScreen from "./components/TicketDetailScreen.js";
import StaffTicketQueueScreen from "./components/StaffTicketQueueScreen.js";
import RequesterDashboardScreen from "./components/RequesterDashboardScreen.js";
import StaffDashboardScreen from "./components/StaffDashboardScreen.js";
import StaffTicketDetailScreen from "./components/StaffTicketDetailScreen.js";
import UserManagementScreen from "./components/UserManagementScreen.js";
import "./theme.css";

export default function App() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, search: window.location.search, hash: window.location.hash }));
    const path = location.pathname;
    const sessionRevision = useRef(0);
    // Only an opaque entry key enters History state; protected return metadata
    // stays in this session-owned map and is invalidated on identity/access changes.
    const requesterReturns = useRef(new Map<string, { identity: string; url: string; ticketId: string }>());
    const identity = user ? user.id + ":" + user.role : "";
    useEffect(() => { requesterReturns.current.clear(); }, [identity]);
    const navigate = (next: string, state: object = {}) => {
        window.history.pushState(state, "", next);
        window.dispatchEvent(new PopStateEvent("popstate"));
    };
    const openRequesterTicket = (id: string) => {
        const entry = crypto.randomUUID();
        requesterReturns.current.set(entry, { identity, url: "/tickets" + window.location.search, ticketId: id });
        navigate("/tickets/" + encodeURIComponent(id), { requesterDetailEntry: entry });
    };
    const requesterBack = () => {
        const entry = requesterReturns.current.get(window.history.state?.requesterDetailEntry);
        navigate(entry?.identity === identity && entry.ticketId === path.slice(9) ? entry.url : "/tickets");
    };
    useEffect(() => {
        const onPop = () => setLocation({ pathname: window.location.pathname, search: window.location.search, hash: window.location.hash });
        window.addEventListener("popstate", onPop);
        window.addEventListener("hashchange", onPop);
        return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("hashchange", onPop); };
    }, []);
    useEffect(() => {
        let active = true;
        const revision = ++sessionRevision.current;
        getCurrentUser().then(next => {
            if (active && revision === sessionRevision.current) setUser(next);
        }).catch(err => {
            if (active && revision === sessionRevision.current && !(err instanceof ApiError && err.status === 401)) {
                setError("Unable to restore your session. Please sign in again.");
            }
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);
    useEffect(() => {
        const reset = () => {
            // Remove protected content immediately when an API rejects session access.
            requesterReturns.current.clear();
            setUser(null);
            const revision = ++sessionRevision.current;
            getCurrentUser().then(next => {
                if (revision === sessionRevision.current) setUser(next);
            }).catch(() => {});
        };
        window.addEventListener("session-access-changed", reset);
        return () => {
            ++sessionRevision.current;
            window.removeEventListener("session-access-changed", reset);
        };
    }, []);
    const signOut = async () => {
        ++sessionRevision.current;
        try {
            await logout();
            // Also invalidate any refresh started while logout was in flight.
            ++sessionRevision.current;
            requesterReturns.current.clear();
            setUser(null);
            setError("");
            navigate("/login");
        } catch {
            setError("Unable to log out. Please try again.");
        }
    };
    const onAuthenticated = (next: AuthUser) => {
        ++sessionRevision.current;
        setUser(next);
        setError("");
        navigate(next.role === "REQUESTER" ? "/tickets" : "/staff/tickets");
    };
    // Snapshot the existing session revision; logout invalidates it synchronously,
    // even before its response causes the protected component to unmount.
    const submissionRevision = sessionRevision.current;
    const isSubmissionSessionCurrent = () => submissionRevision === sessionRevision.current;
    return <>{error && <div role="alert" className="alert alert-danger">{error}</div>}
 {loading ? <div role="status">Loading TokTickIT...</div> : !user || user.mustChangePassword ? <AuthScreen user={user} onAuthenticated={onAuthenticated} onLogout={signOut}/> :
            <AppShell currentUser={user} onLogout={signOut} activePath={path}>
 {user.role === "REQUESTER" ? <>
 {path === "/dashboard" && <RequesterDashboardScreen key={identity} currentUser={user} onNavigate={navigate}/> }
 {(path === "/tickets" || path === "/" || path === "/login") && <MyTicketsScreen key={identity} currentRequester={user} onCreateTicket={() => navigate("/tickets/new")} onOpenTicket={openRequesterTicket}/>}
 {path === "/tickets/new" && <CreateTicketScreen key={identity} currentRequester={user} isSessionCurrent={isSubmissionSessionCurrent} onCreated={ticket => navigate("/tickets/" + ticket.id)} onCancel={() => navigate("/tickets")}/>}
 {path.startsWith("/tickets/") && path !== "/tickets/new" && <TicketDetailScreen key={identity + path} currentRequester={user} ticketId={path.slice(9)} onBack={requesterBack}/>}
 {!path.startsWith("/tickets") && path !== "/" && path !== "/login" && path !== "/dashboard" && <p role="alert">This page is not available for your role.</p>}
 </> : <>
    {path === "/staff/dashboard" && <StaffDashboardScreen key={user.id + user.role} currentUser={user} onNavigate={navigate}/>}
    {(path === "/staff/tickets" ||
        path === "/" ||
        path === "/login") && (
        <StaffTicketQueueScreen
            key={user.id + user.role}
            currentUser={user}
            onOpenTicket={(id) =>
                navigate("/staff/tickets/" + id)
            }
        />
    )}

    {path.startsWith("/staff/tickets/") && (
        <StaffTicketDetailScreen key={user.id + path} ticketId={path.slice("/staff/tickets/".length)} currentUser={user} onBack={() => navigate("/staff/tickets")} />
    )}

    {path === "/admin/users" &&
        user.role === "ADMINISTRATOR" && (
            <UserManagementScreen currentUser={user} />
        )}

    {(path === "/dashboard" || path.startsWith("/tickets") ||
        (path.startsWith("/admin") &&
            user.role !== "ADMINISTRATOR")) && (
        <p role="alert">
            This page is not available for your role.
        </p>
    )}

    {!path.startsWith("/staff/tickets") &&
        !path.startsWith("/tickets") &&
        path !== "/" &&
        path !== "/login" &&
        path !== "/staff/dashboard" &&
        path !== "/dashboard" &&
        path !== "/admin/users" && (
            <p>This page is not available yet.</p>
        )}
</>}
 </AppShell>}
 <SystemDiagnostic />
 </>;
}
