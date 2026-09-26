import { FormEvent, useState } from "react";
import { ApiError, AuthUser, login, changePassword, getCurrentUser } from "../api.js";
import FormField from "./common/FormField.js";

const passwordGuidance = "Use 8–72 characters with at least one letter and one number.";
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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    async function submit(event: FormEvent) {
        event.preventDefault();
        if (busy)
            return;
        setError("");
        setFieldErrors({});
        if (user) {
            const fields: Record<string, string> = {};
            if (!password) fields.currentPassword = "Current password is required.";
            if ([...next].length < 8 || [...next].length > 72 || !/\p{L}/u.test(next) || !/[0-9]/.test(next)) fields.newPassword = passwordGuidance;
            if (!confirm || next !== confirm) fields.confirmPassword = "Password confirmation must match the new password.";
            setFieldErrors(fields);
            if (Object.keys(fields).length) return;
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
            if (user && err instanceof ApiError && err.code === "INVALID_CURRENT_PASSWORD") {
                setFieldErrors({ currentPassword: "Current password is incorrect." });
            } else if (user && err instanceof ApiError && err.code === "VALIDATION_ERROR") {
                const fields = Object.fromEntries(Object.entries(err.fields).filter(([key]) =>
                    ["currentPassword", "newPassword", "confirmPassword"].includes(key)));
                setFieldErrors(fields);
                if (!Object.keys(fields).length) setError(err.message);
            } else {
                setError(user
                    ? err instanceof ApiError ? err.message : "Unable to change your password. Please try again."
                    : err instanceof Error ? err.message : "Unable to sign in.");
            }
        }
        finally {
            setBusy(false);
        }
    }
    return <main className="auth-layout px-3 py-4"><div className="zen-card auth-card p-4 p-sm-5 w-100"><p className="fw-bold text-primary-green mb-2">TokTickIT</p><h1 className="h3 mb-2">{user ? "Change Password" : "Login"}</h1><p className="text-secondary mb-4">{user ? "Choose a new password to continue to TokTickIT." : "Sign in to access your tickets."}</p><form onSubmit={submit} aria-busy={busy} noValidate={Boolean(user)}>
 {!user && <label className="d-block mb-3">Email<input className="form-control" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
 <FormField id="auth-current-password" label={user ? "Current Password" : "Password"} error={fieldErrors.currentPassword}><input className="form-control" type="password" autoComplete="current-password" required value={password} onChange={e => { setPassword(e.target.value); setFieldErrors(previous => ({ ...previous, currentPassword: "" })); }}/></FormField>
 {user && <>
   <FormField id="auth-new-password" label="New Password" helperText={passwordGuidance} error={fieldErrors.newPassword}><input className="form-control" type="password" autoComplete="new-password" required value={next} onChange={e => { setNext(e.target.value); setFieldErrors(previous => ({ ...previous, newPassword: "", confirmPassword: "" })); }}/></FormField>
   <FormField id="auth-confirm-password" label="Confirm New Password" error={fieldErrors.confirmPassword}><input className="form-control" type="password" autoComplete="new-password" required value={confirm} onChange={e => { setConfirm(e.target.value); setFieldErrors(previous => ({ ...previous, confirmPassword: "" })); }}/></FormField>
 </>}
 {error && <p role="alert" className="alert alert-danger">{error}</p>}<button className="btn btn-primary-green" disabled={busy}>{busy ? (user ? "Saving..." : "Signing in...") : user ? "Change Password" : "Login"}</button>
 {user && <button type="button" className="btn btn-link" onClick={onLogout}>Logout</button>}
 </form></div></main>;
}
