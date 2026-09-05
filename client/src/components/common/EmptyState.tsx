import React from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}) => {
  const defaultIcon = (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );

  return (
    <div
      className={`zen-card text-center p-5 d-flex flex-column align-items-center justify-content-center ${className}`.trim()}
      data-testid="empty-state"
    >
      <div className="mb-3 text-secondary" aria-hidden="true">
        {icon || defaultIcon}
      </div>
      <h2 className="h5 fw-bold text-primary-green mb-2">{title}</h2>
      <p className="text-secondary mb-4" style={{ maxWidth: 480 }}>
        {description}
      </p>

      {actionLabel && (
        <div>
          {actionHref ? (
            <a
              href={actionHref}
              className="btn btn-primary-green"
              onClick={(e) => {
                if (onAction) {
                  e.preventDefault();
                  onAction();
                }
              }}
            >
              {actionLabel}
            </a>
          ) : (
            <button
              type="button"
              className="btn btn-primary-green"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
