import React from "react";

export interface FormFieldProps {
    id: string;
    label: string;
    required?: boolean;
    helperText?: string;
    error?: string;
    children: React.ReactElement;
    className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
    id,
    label,
    required = false,
    helperText,
    error,
    children,
    className = "",
}) => {
    const helperId = helperText ? `${id}-helper` : undefined;
    const errorId = error ? `${id}-error` : undefined;

    const describedBy =
        [helperId, errorId].filter(Boolean).join(" ") || undefined;

    const control = React.cloneElement(children, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
    });

    return (
        <div className={`mb-3 ${className}`.trim()}>
            <label htmlFor={id} className="form-label fw-semibold">
                {label}
                {required && (
                    <span className="text-danger ms-1" aria-hidden="true">
                        *
                    </span>
                )}
            </label>

            {control}

            {helperText && (
                <div id={helperId} className="form-text">
                    {helperText}
                </div>
            )}

            {error && (
                <div id={errorId} className="text-danger mt-1" role="alert">
                    <span aria-hidden="true" className="me-1">
                        ⚠
                    </span>
                    {error}
                </div>
            )}
        </div>
    );
};

export default FormField;