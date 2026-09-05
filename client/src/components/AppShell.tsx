import React, { useState } from "react";
import { DevelopmentRequester } from "../api.js";

interface AppShellProps {
  currentRequester: DevelopmentRequester;
  onChangeRequester: () => void;
  activePath?: string;
  children?: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentRequester,
  onChangeRequester,
  activePath = "/tickets",
  children,
}) => {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="d-flex flex-column min-vh-100" style={{ backgroundColor: "#F5F7F6" }}>
      {/* Top Navigation Bar */}
      <nav
        className="navbar navbar-expand-lg navbar-light bg-white border-bottom shadow-sm sticky-top"
        style={{ borderColor: "#E0E6E2" }}
      >
        <div className="container-fluid px-3 px-md-4">
          {/* Brand Logo */}
          <a
            href="/tickets"
            className="navbar-brand fw-bold fs-4 text-primary-green d-flex align-items-center me-4"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, "", "/tickets");
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
              <li className="nav-item">
                <a
                  href="/tickets"
                  className={`nav-link px-3 ${activePath === "/tickets"
                    ? "fw-bold text-primary-green active"
                    : "text-secondary"
                    }`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/tickets");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    setNavOpen(false);
                  }}
                >
                  My Tickets
                </a>
              </li>
              <li className="nav-item">
                <a
                  href="/tickets/new"
                  className={`nav-link px-3 ${activePath === "/tickets/new"
                    ? "fw-bold text-primary-green active"
                    : "text-secondary"
                    }`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, "", "/tickets/new");
                    window.dispatchEvent(new PopStateEvent("popstate"));
                    setNavOpen(false);
                  }}
                >
                  Create Ticket
                </a>
              </li>
            </ul>

            {/* Right-aligned Requester Badge & Change Requester button */}
            <div className="d-flex align-items-center flex-wrap gap-2 pt-2 pt-lg-0">
              <span
                className="badge rounded-pill bg-pale-green text-primary-green px-3 py-2 border border-primary-green"
                data-testid="requester-badge"
                role="status"
                aria-label={`Current requester: ${currentRequester.name}`}
              >
                Requester: {currentRequester.name}
              </span>

              <button
                type="button"
                className="btn btn-sm btn-outline-primary-green"
                onClick={() => {
                  setNavOpen(false);
                  onChangeRequester();
                }}
              >
                Change Requester
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
