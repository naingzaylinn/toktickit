import React, { useState } from "react";
import { AuthUser } from "../api.js";

interface AppShellProps {
  currentUser: AuthUser;
  onLogout: () => void;
  activePath?: string;
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentUser,
  onLogout,
  activePath = "/tickets",
  children,
}) => {
  const [navOpen, setNavOpen] = useState(false);
  const isCurrent = (path: string) => activePath === path ||
    (path === "/tickets" && activePath.startsWith("/tickets/") && activePath !== "/tickets/new") ||
    (path === "/staff/tickets" && activePath.startsWith("/staff/tickets/"));

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: "#F5F7F6" }}>
      {/* Top Navigation Bar */}
      <nav
        className="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm sticky-top"
        aria-label="Main navigation"
        style={{ borderColor: "#e0e6e2" }}
      >
        <div className="container-fluid px-3 px-md-4">
          {/* Brand Logo */}
          <a
            href={currentUser.role === "REQUESTER" ? "/tickets" : "/staff/tickets"}
            className="navbar-brand fw-bold fs-4 text-primary-green d-flex align-items-center me-4"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, "", currentUser.role === "REQUESTER" ? "/tickets" : "/staff/tickets");
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
          >
            TokTickIT
          </a>

          {/* Mobile hamburger toggle */}
          <button
            className="navbar-toggler border-0"
            type="button"
            aria-controls="toktickit-navbar-nav"
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen(!navOpen)}
          >
            <span className="navbar-toggler-icon" />
          </button>

          {/* Collapsible content */}
          <div
            className={`collapse navbar-collapse ${navOpen ? "show" : ""}`}
            id="toktickit-navbar-nav"
          >
            {/* Links */}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              {(currentUser.role === "REQUESTER" ? [["/tickets", "My Tickets"], ["/tickets/new", "Create Ticket"]] : currentUser.role === "ADMINISTRATOR" ? [["/staff/tickets", "Ticket Queue"], ["/admin/users", "User Management"]] : [["/staff/tickets", "Ticket Queue"]]).map(([path,label]) => <li className="nav-item" key={path}><a aria-current={isCurrent(path) ? "page" : undefined} className={"nav-link px-3 " + (isCurrent(path) ? "active fw-bold text-primary-green" : "text-secondary")} href={path} onClick={e=>{e.preventDefault();window.history.pushState({},"",path);window.dispatchEvent(new PopStateEvent("popstate"));setNavOpen(false);}}>{label}</a></li>)}
            </ul>

            {/* Authenticated identity and logout */}
            <div className="d-flex align-items-center flex-wrap gap-2 pt-2 pt-lg-0">
              <span
                className="badge rounded-pill bg-pale-green text-primary-green px-3 py-2 border border-primary-green"
                data-testid="requester-badge"
                role="status"
                aria-label={`Current user: ${currentUser.name}`}
              >
                {({REQUESTER: "Requester", IT_STAFF: "IT Staff", ADMINISTRATOR: "Administrator"})[currentUser.role]}: {currentUser.name}
              </span>

              <button
                type="button"
                className="btn btn-sm btn-outline-primary-green"
                onClick={() => {
                  setNavOpen(false);
                  onLogout();
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow-1 container py-4 px-3 px-md-4">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
