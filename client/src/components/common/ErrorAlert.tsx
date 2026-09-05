import React from "react";

export interface ErrorAlertProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryText?: string;
  className?: string;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({
  message,
  title = "Error",
  onRetry,
  retryText = "Retry",
  className = "",
}) => {
  return (
    <div
      className={`alert alert-danger d-flex align-items-start gap-3 p-3 zen-card-error ${className}`.trim()}
      role="alert"
      aria-live="polite"
    >
      <svg
        className="bi flex-shrink-0 mt-1"
        width="20"
        height="20"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
      </svg>
      <div className="flex-grow-1">
        {title && <h6 className="alert-heading fw-bold mb-1">{title}</h6>}
        <div className="alert-message text-break">{message}</div>
      </div>
      {onRetry && (
        <div className="ms-auto flex-shrink-0">
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={onRetry}
            aria-label={`${retryText}: ${title || "operation"}`}
          >
            {retryText}
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorAlert;
