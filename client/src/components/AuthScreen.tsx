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
    return <main className="container py-5" style={{ maxWidth: 520 }}><h1>TokTickIT</h1><h2>{user ? "Change Password" : "Login"}</h2><form onSubmit={submit}>
 {!user && <label className="d-block mb-3">Email<input className="form-control" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
 <label className="d-block mb-3">{user ? "Current Password" : "Password"}<input className="form-control" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label>
 {user && <><label className="d-block mb-3">New Password<input className="form-control" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)}/></label><label className="d-block mb-3">Confirm New Password<input className="form-control" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)}/></label></>}
 {error && <p role="alert">{error}</p>}<button className="btn btn-primary-green" disabled={busy}>{busy ? "Saving..." : user ? "Change Password" : "Login"}</button>
 {user && <button type="button" className="btn btn-link" onClick={onLogout}>Logout</button>}
 </form></main>;
}
