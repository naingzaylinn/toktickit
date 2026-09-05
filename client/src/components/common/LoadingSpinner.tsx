import React from "react";

export interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  centered?: boolean;
  inline?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading content, please wait...",
  size = "md",
  centered = true,
  inline = false,
  className = "",
}) => {
  const spinnerSizeClass = size === "sm" ? "spinner-border-sm" : "";
  const sizeStyle =
    size === "lg" ? { width: "3rem", height: "3rem" } : undefined;

  return (
    <div
      className={`d-flex align-items-center ${centered && !inline ? "justify-content-center p-4" : ""
        } ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div
        className={`spinner-border text-primary-green ${spinnerSizeClass}`}
        style={sizeStyle}
        aria-hidden="true"
      />

      <span className={inline ? "ms-2 text-secondary" : "visually-hidden"}>
        {message}
      </span>
    </div>
  );
};

export default LoadingSpinner;