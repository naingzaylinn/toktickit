import { useEffect, useState } from "react";
import {
  DevelopmentRequester,
  getDevelopmentRequesters,
  REQUESTER_STORAGE_KEY,
  checkSystem,
  Category,
} from "./api.js";
import RequesterSelectScreen from "./components/RequesterSelectScreen.js";
import AppShell from "./components/AppShell.js";
import "./theme.css";
import CreateTicketScreen from "./components/CreateTicketScreen.js";
import MyTicketsScreen from "./components/MyTicketsScreen.js";
import TicketDetailScreen from "./components/TicketDetailScreen.js";

type UiState = "idle" | "loading" | "success" | "error";

export default function App() {
  const [currentRequester, setCurrentRequester] = useState<DevelopmentRequester | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname || "/");
  const [initializing, setInitializing] = useState<boolean>(true);
  const [redirectAlert, setRedirectAlert] = useState<string | null>(null);

  // Lab 1 state preservation for regression tests
  const [checkState, setCheckState] = useState<UiState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Listen to popstate (browser back/forward or history navigation)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || "/");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Validate and restore requester context on initial boot / refresh
  useEffect(() => {
    const restoreRequesterContext = async () => {
      const storedId = sessionStorage.getItem(REQUESTER_STORAGE_KEY);
      if (!storedId) {
        setInitializing(false);
        return;
      }

      try {
        const activeRequesters = await getDevelopmentRequesters();
        const found = activeRequesters.find((r) => r.id === storedId);

        if (found) {
          // Valid active requester restored
          setCurrentRequester(found);

          if (
            window.location.pathname === "/" ||
            window.location.pathname === "/requester-select"
          ) {
            window.history.pushState({}, "", "/tickets");
            setCurrentPath("/tickets");
          }
        } else {
          // Inactive or nonexistent stored requester
          sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
          setCurrentRequester(null);
          setRedirectAlert("The previously selected Development Requester is no longer active or available.");
          window.history.pushState({}, "", "/requester-select");
          setCurrentPath("/requester-select");
        }
      } catch {
        // Safe fallback on validation failure
        sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
        setCurrentRequester(null);
        setRedirectAlert("Unable to restore Development Requester context. Please re-select an active requester.");
        window.history.pushState({}, "", "/requester-select");
        setCurrentPath("/requester-select");
      } finally {
        setInitializing(false);
      }
    };

    restoreRequesterContext();
  }, []);

  const handleSelectRequester = (requester: DevelopmentRequester) => {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, requester.id);
    setCurrentRequester(requester);
    setRedirectAlert(null);
    window.history.pushState({}, "", "/tickets");
    setCurrentPath("/tickets");
  };

  const handleChangeRequester = () => {
    // Navigate to /requester-select and clear draft state
    window.history.pushState({}, "", "/requester-select");
    setCurrentPath("/requester-select");
  };

  // Lab 1 handler
  async function handleCheck() {
    setCheckState("loading");
    setErrorMessage("");
    try {
      const result = await checkSystem();
      setCategories(result.categories);
      setCheckState("success");
    } catch (err: unknown) {
      setCheckState("error");
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred");
      }
    }
  }

  if (initializing) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100" role="status">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading TokTickIT...</span>
        </div>
      </div>
    );
  }

  // If no requester selected or explicitly at /requester-select, show selection screen
  const showSelectScreen = !currentRequester || currentPath === "/requester-select";

  return (
    <div>
      {showSelectScreen ? (
        <div>
          <RequesterSelectScreen
            onSelectRequester={handleSelectRequester}
            initialAlert={redirectAlert}
          />
        </div>
      ) : (
        <AppShell
          currentRequester={currentRequester}
          onChangeRequester={handleChangeRequester}
          activePath={currentPath}
        >
          {currentPath === "/tickets" && (
            <MyTicketsScreen
              currentRequester={currentRequester}
              onCreateTicket={() => {
                window.history.pushState({}, "", "/tickets/new");
                setCurrentPath("/tickets/new");
              }}
              onOpenTicket={(ticketId) => {
                window.history.pushState({}, "", `/tickets/${ticketId}`);
                setCurrentPath(`/tickets/${ticketId}`);
              }}
            />
          )}

          {currentPath === "/tickets/new" && (
            <CreateTicketScreen
              currentRequester={currentRequester}
              onCreated={(ticket) => {
                window.history.pushState({}, "", `/tickets/${ticket.id}`);
                setCurrentPath(`/tickets/${ticket.id}`);
              }}
              onCancel={() => {
                window.history.pushState({}, "", "/tickets");
                setCurrentPath("/tickets");
              }}
            />
          )}

          {currentPath.startsWith("/tickets/") &&
            currentPath !== "/tickets/new" && (
              <TicketDetailScreen
                currentRequester={currentRequester}
                ticketId={currentPath.replace("/tickets/", "")}
                onBack={() => {
                  window.history.pushState({}, "", "/tickets");
                  setCurrentPath("/tickets");
                }}
              />
            )}
        </AppShell>
      )}

      {/* Lab 1 Regression / Diagnostic System Status Section */}
      <div className="container py-3" style={{ maxWidth: 640 }}>
        <hr className="my-4 text-muted" />
        <div className="d-flex align-items-center justify-content-between">
          <span className="small text-muted">System Diagnostic:</span>
          <button
            className="btn btn-sm btn-outline-success"
            onClick={handleCheck}
            disabled={checkState === "loading"}
          >
            {checkState === "loading" ? "Loading…" : "Check System"}
          </button>
        </div>

        {checkState === "success" && (
          <div className="alert alert-success mt-3" role="alert">
            <strong>Online</strong>
            {categories.length > 0 && (
              <ul className="mt-2 mb-0">
                {categories.map((category) => (
                  <li key={category.id}>{category.name}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {checkState === "error" && (
          <div className="alert alert-danger mt-3" role="alert">
            <strong>Offline</strong>
            {errorMessage && <div className="small mt-1">{errorMessage}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
