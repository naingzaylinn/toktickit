import React, { useEffect, useState } from "react";
import {
  DevelopmentRequester,
  getDevelopmentRequesters,
  REQUESTER_STORAGE_KEY,
} from "../api.js";

interface RequesterSelectScreenProps {
  onSelectRequester?: (requester: DevelopmentRequester) => void;
  initialAlert?: string | null;
}

export const RequesterSelectScreen: React.FC<RequesterSelectScreenProps> = ({
  onSelectRequester,
  initialAlert,
}) => {
  const [requesters, setRequesters] = useState<DevelopmentRequester[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(initialAlert ?? null);

  const fetchRequesters = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await getDevelopmentRequesters();
      setRequesters(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message || "Unable to load development requesters.");
      } else {
        setErrorMessage("Unable to load development requesters.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequesters();
  }, []);

  useEffect(() => {
    if (initialAlert) {
      setAlertMessage(initialAlert);
    }
  }, [initialAlert]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedId(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedId || selectedId.trim() === "") {
      setValidationError("Please select a development requester.");
      return;
    }

    const chosen = requesters.find((r) => r.id === selectedId);
    if (!chosen) {
      setValidationError("Please select a development requester.");
      return;
    }

    // Persist strictly to browser tab-scoped sessionStorage
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, chosen.id);

    if (onSelectRequester) {
      onSelectRequester(chosen);
    } else {
      // Default navigation to /tickets
      window.history.pushState({}, "", "/tickets");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  return (
    <div
      className="container d-flex flex-column justify-content-center align-items-center py-5 min-vh-100"
      style={{ maxWidth: 680 }}
    >
      <div className="w-100 zen-card p-4 p-md-5">
        {/* Header & Branding */}
        <div className="text-center mb-4">
          <h1 className="h3 fw-bold text-primary-green mb-1">TokTickIT</h1>
          <h2 className="h5 text-secondary fw-normal mb-0">
            Development Requester Selection
          </h2>
        </div>

        {/* Redirect / Inactive stored requester Alert Banner */}
        {alertMessage && (
          <div
            className="alert alert-warning alert-dismissible fade show mb-4"
            role="alert"
          >
            <strong>Notice:</strong> {alertMessage}
            <button
              type="button"
              className="btn-close"
              aria-label="Close alert"
              onClick={() => setAlertMessage(null)}
            />
          </div>
        )}

        {/* Explanatory Testing Disclaimer Callout */}
        <div
          className="p-3 mb-4 rounded bg-pale-green border-start border-4 border-primary-green"
          role="note"
        >
          <div className="fw-semibold text-primary-green mb-1">
            Testing Identity Disclaimer
          </div>
          <p className="small mb-0 text-muted">
            Select a Development Requester to test requester-specific ticketing
            features. This is a temporary testing selector for Lab 2; full
            authentication will be introduced in Lab 3. There are no passwords,
            login credentials, or secure sessions.
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4" role="status">
            <div className="spinner-border text-success mb-2" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <div className="text-muted small">Loading active requesters...</div>
          </div>
        )}

        {/* Error State with Retry Button */}
        {!loading && errorMessage && (
          <div className="alert alert-danger mb-4" role="alert">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <strong>Error: </strong>
                <span>Unable to load development requesters.</span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={fetchRequesters}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Empty List State */}
        {!loading && !errorMessage && requesters.length === 0 && (
          <div className="alert alert-info text-center py-4 mb-4" role="alert">
            <p className="mb-3 fw-semibold">
              No active Development Requesters are currently available.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary-green"
              onClick={fetchRequesters}
            >
              Retry
            </button>
          </div>
        )}

        {/* Form Controls */}
        {!loading && !errorMessage && requesters.length > 0 && (
          <form onSubmit={handleContinue} noValidate>
            <div className="mb-4">
              <label
                htmlFor="requester-select"
                className="form-label fw-semibold"
              >
                Development Requester
              </label>
              <select
                id="requester-select"
                className={`form-select form-select-lg ${
                  validationError ? "is-invalid" : ""
                }`}
                value={selectedId}
                onChange={handleSelectChange}
                aria-describedby={
                  validationError ? "requester-error-msg" : undefined
                }
                aria-invalid={validationError ? "true" : "false"}
              >
                <option value="">-- Select an Active Requester --</option>
                {requesters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {`${r.name} (${r.email})`}
                  </option>
                ))}
              </select>

              {validationError && (
                <div
                  id="requester-error-msg"
                  className="invalid-feedback d-block mt-2"
                >
                  {validationError}
                </div>
              )}
            </div>

            <div className="d-grid gap-2">
              <button
                type="submit"
                className="btn btn-primary-green btn-lg py-2"
                disabled={!selectedId}
              >
                Continue
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RequesterSelectScreen;
