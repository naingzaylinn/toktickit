import React from "react";

export interface StatusBadgeProps {
    label: string;
    variant?: "success" | "warning" | "danger" | "info" | "neutral";
    className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    label,
    variant = "neutral",
    className = "",
}) => {
    const variantClass = {
        success: "status-badge-success",
        warning: "status-badge-warning",
        danger: "status-badge-danger",
        info: "status-badge-info",
        neutral: "status-badge-neutral",
    }[variant];

    return (
        <span className={`status-badge ${variantClass} ${className}`.trim()}>
            <span aria-hidden="true" className="me-1">
                ●
            </span>
            <span>{label}</span>
        </span>
    );
};

export default StatusBadge;