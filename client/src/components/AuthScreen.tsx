import { FormEvent, useState } from "react";
import { AuthUser, login, changePassword, getCurrentUser } from "../api.js";
export default function AuthScreen({ user, onAuthenticated, onLogout }: {
    user: AuthUser | null;
    onAuthenticated: (user: AuthUser) => void;
    onLogout: () => void;
}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy)
            return;
        setError("");
        if (user && ([...next].length < 8 || [...next].length > 72 || !/\p{L}/u.test(next) || !/[0-9]/.test(next) || next !== confirm)) {
            setError("New passwords must match and contain 8-72 characters, a letter and a number.");
            return;
        }
        setBusy(true);
        try {
            if (user) {
                await changePassword(password, next, confirm);
                onAuthenticated(await getCurrentUser());
            }
            else {
                onAuthenticated((await login(email, password)).user);
            }
            setPassword("");
            setNext("");
            setConfirm("");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Unable to sign in.");
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="auth-layout px-3 py-4"><div className="zen-card auth-card p-4 p-sm-5 w-100"><p className="fw-bold text-primary-green mb-2">TokTickIT</p><h1 className="h3 mb-2">{user ? "Change Password" : "Login"}</h1><p className="text-secondary mb-4">{user ? "Choose a new password to continue to TokTickIT." : "Sign in to access your tickets."}</p><form onSubmit={submit} aria-busy={busy}>
 {!user && <label className="d-block mb-3">Email<input className="form-control" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
 <label className="d-block mb-3">{user ? "Current Password" : "Password"}<input className="form-control" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
 {user && <><label className="d-block mb-3">New Password<input className="form-control" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)}/></label><label className="d-block mb-3">Confirm New Password<input className="form-control" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)}/></label></>}
 {error && <p role="alert" className="alert alert-danger">{error}</p>}<button className="btn btn-primary-green" disabled={busy}>{busy ? (user ? "Saving..." : "Signing in...") : user ? "Change Password" : "Login"}</button>
 {user && <button type="button" className="btn btn-link" onClick={onLogout}>Logout</button>}
 </form></div></main>;
}
