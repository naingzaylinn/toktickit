import { useEffect, useRef, useState } from "react";
import { AuthUser, ApiError, getCurrentUser, logout } from "./api.js";
import AppShell from "./components/AppShell.js";
import AuthScreen from "./components/AuthScreen.js";
import SystemDiagnostic from "./components/SystemDiagnostic.js";
import CreateTicketScreen from "./components/CreateTicketScreen.js";
import MyTicketsScreen from "./components/MyTicketsScreen.js";
import TicketDetailScreen from "./components/TicketDetailScreen.js";
import "./theme.css";
export default function App() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [path, setPath] = useState(window.location.pathname);
    const sessionRevision = useRef(0);
    const navigate = (next: string) => {
        window.history.pushState({}, "", next);
        setPath(next);
    };
    useEffect(() => {
        const onPop = () => setPath(window.location.pathname);
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
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
    return <>{error && <div role="alert" className="alert alert-danger">{error}</div>}
 {loading ? <div role="status">Loading TokTickIT...</div> : !user || user.mustChangePassword ? <AuthScreen user={user} onAuthenticated={onAuthenticated} onLogout={signOut}/> :
            <AppShell currentUser={user} onLogout={signOut} activePath={path}>
 {user.role === "REQUESTER" ? <>
 {(path === "/tickets" || path === "/" || path === "/login") && <MyTicketsScreen currentRequester={user} onCreateTicket={() => navigate("/tickets/new")} onOpenTicket={id => navigate("/tickets/" + id)}/>}
 {path === "/tickets/new" && <CreateTicketScreen currentRequester={user} onCreated={ticket => navigate("/tickets/" + ticket.id)} onCancel={() => navigate("/tickets")}/>}
 {path.startsWith("/tickets/") && path !== "/tickets/new" && <TicketDetailScreen key={user.id + path} currentRequester={user} ticketId={path.slice(9)} onBack={() => navigate("/tickets")}/>}
 {!path.startsWith("/tickets") && path !== "/" && path !== "/login" && <p role="alert">This page is not available for your role.</p>}
 </> : <p>{path.startsWith("/tickets") || (path.startsWith("/admin") && user.role !== "ADMINISTRATOR") ? "This page is not available for your role." : "This page is not available yet."}</p>}
 </AppShell>}
 <SystemDiagnostic />
 </>;
}
