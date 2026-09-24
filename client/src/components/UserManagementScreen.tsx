import { useEffect, useState } from "react";
import { ApiError, AuthUser, ManagedUser, UserDraft, UserRole, createManagedUser, getManagedUsers, setManagedInitialPassword, updateManagedUser } from "../api.js";

const roles: UserRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];
const label = (role: UserRole) => ({ REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator" })[role];
const blank: UserDraft = { name: "", email: "", role: "REQUESTER", isActive: true };
const passwordError = (value: string) => [...value].length < 8 || [...value].length > 72 || !/\p{L}/u.test(value) || !/[0-9]/.test(value);

export default function UserManagementScreen({ currentUser }: { currentUser: AuthUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [listFailed, setListFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<ManagedUser | "new" | null>(null);
  const [draft, setDraft] = useState<UserDraft>(blank);
  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    if (currentUser.role !== "ADMINISTRATOR") { setForbidden(true); setLoading(false); return; }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => getManagedUsers(search, role).then(data => {
      if (active) { setUsers(data); setError(""); setListFailed(false); setForbidden(false); }
    }).catch(err => {
      if (active) { setUsers([]); setMessage(""); setListFailed(true); setForbidden(err instanceof ApiError && err.status === 403); setError("Unable to load users. Please retry."); }
    }).finally(() => { if (active) setLoading(false); }), search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [currentUser.role, search, role, revision]);

  const openEdit = (user: ManagedUser | "new") => {
    setEditing(user);
    setPasswordTarget(null);
    setDraft(user === "new" ? blank : { name: user.name, email: user.email, role: user.role, isActive: user.isActive });
    setPassword(""); setError(""); setMessage("");
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) || !roles.includes(draft.role) ||
        (editing === "new" && passwordError(password))) { setError("Enter a name, valid email, role, and an initial password of 8 to 72 characters with a letter and number."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      if (editing === "new") await createManagedUser({ ...draft, initialPassword: password });
      else if (editing) await updateManagedUser(editing.id, draft);
      setEditing(null); setPassword(""); setMessage(editing === "new" ? "User created." : "User updated."); setRevision(value => value + 1);
    } catch (err) { setError(err instanceof ApiError && err.status === 409 ? err.message : "Unable to save user. Please retry."); }
    finally { setBusy(false); }
  };
  const setInitial = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordError(password) || password !== confirm) { setError("Use 8 to 72 characters with a letter and number, and matching confirmation."); return; }
    if (!passwordTarget) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await setManagedInitialPassword(passwordTarget.id, password);
      setPasswordTarget(null); setPassword(""); setConfirm(""); setMessage("Initial password set. The user must change it before normal access."); setRevision(value => value + 1);
    } catch { setError("Unable to set the initial password. Please retry."); }
    finally { setBusy(false); }
  };
  const toggle = async (user: ManagedUser) => {
    if (!window.confirm(`${user.isActive ? "Deactivate" : "Activate"} ${user.name}?`)) return;
    setBusy(true); setError(""); setMessage("");
    try { await updateManagedUser(user.id, { name: user.name, email: user.email, role: user.role, isActive: !user.isActive }); setMessage(user.isActive ? "User deactivated." : "User activated."); setRevision(value => value + 1); }
    catch (err) { setError(err instanceof ApiError && err.status === 409 ? err.message : "Unable to update activation. Please retry."); }
    finally { setBusy(false); }
  };

  if (forbidden) return <div role="alert" className="alert alert-danger">You are not permitted to manage users.</div>;
  return <section className="user-management-screen">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4"><h1>User Management</h1><button className="btn btn-primary-green" disabled={busy} onClick={() => openEdit("new")}>Create User</button></div>
    {message && <div role="status" className="alert alert-success">{message}</div>}
    {error && <div role="alert" className="alert alert-danger">{error} {loading === false && !editing && !passwordTarget && <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => setRevision(value => value + 1)}>Retry</button>}</div>}
    <div className="row g-2 mb-3"><div className="col-12 col-md-8"><label htmlFor="user-search" className="form-label">Search by name or email</label><input id="user-search" className="form-control" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="col-12 col-md-4"><label htmlFor="role-filter" className="form-label">Role</label><select id="role-filter" className="form-select" value={role} onChange={e => setRole(e.target.value)}><option value="">All roles</option>{roles.map(item => <option key={item} value={item}>{label(item)}</option>)}</select></div></div>
    {loading ? <p role="status">Loading users...</p> : listFailed ? null : users.length === 0 ? <p>{search || role ? "No users match your search or filter." : "No users are available."}</p> : <div className="row g-3">{users.map(user => <div className="col-12 col-lg-6" key={user.id}><article className="zen-card h-100 p-3"><h2 className="h5 text-break">{user.name}</h2><p className="text-break mb-2">{user.email}</p><p className="d-flex flex-wrap gap-2 mb-3"><span className="status-badge status-badge-info">{label(user.role)}</span><span className={`status-badge ${user.isActive ? "status-badge-success" : "status-badge-neutral"}`}>{user.isActive ? "Active" : "Inactive"}</span>{user.mustChangePassword && <span className="status-badge status-badge-warning">Password change required</span>}</p><div className="d-flex flex-wrap gap-2"><button className="btn btn-sm btn-outline-primary-green" disabled={busy} onClick={() => openEdit(user)}>Edit</button><button className={`btn btn-sm ${user.isActive ? "btn-outline-danger" : "btn-outline-primary-green"}`} disabled={busy || user.id === currentUser.id && user.isActive} onClick={() => toggle(user)}>{user.isActive ? "Deactivate" : "Activate"}</button><button className="btn btn-sm btn-outline-primary-green" disabled={busy || user.id === currentUser.id} onClick={() => { setEditing(null); setPasswordTarget(user); setPassword(""); setConfirm(""); setError(""); setMessage(""); }}>Set initial password</button></div></article></div>)}</div>}
    {editing && <form onSubmit={save} className="card card-body mt-4"><h2 className="h4">{editing === "new" ? "Create User" : `Edit ${editing.name}`}</h2><label className="form-label">Name<input className="form-control" required value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label><label className="form-label">Email<input className="form-control" type="email" required value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label><label className="form-label">Role<select className="form-select" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value as UserRole })}>{roles.map(item => <option value={item} key={item}>{label(item)}</option>)}</select></label><label className="form-check my-2"><input className="form-check-input" type="checkbox" checked={draft.isActive} onChange={e => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label>{editing === "new" && <label className="form-label">Initial Password<input className="form-control" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label>}<div className="d-flex gap-2"><button className="btn btn-primary-green" disabled={busy}>{busy ? "Saving..." : "Save User"}</button><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => { setEditing(null); setPassword(""); }}>Cancel</button></div></form>}
    {passwordTarget && <form onSubmit={setInitial} className="card card-body mt-4"><h2 className="h4">Set initial password for {passwordTarget.name}</h2><p>The user must change this password before normal access.</p><label className="form-label">New initial password<input className="form-control" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></label><label className="form-label">Confirm initial password<input className="form-control" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label><div className="d-flex gap-2"><button className="btn btn-primary-green" disabled={busy}>{busy ? "Saving..." : "Set Password"}</button><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => { setPasswordTarget(null); setPassword(""); setConfirm(""); }}>Cancel</button></div></form>}
  </section>;
}
