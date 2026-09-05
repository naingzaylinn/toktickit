import React, { useEffect } from "react";

export interface ConfirmModalProps {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    open,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    busy = false,
    onConfirm,
    onCancel,
}) => {
    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && !busy) {
                onCancel();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, busy, onCancel]);

    if (!open) return null;

    return (
        <div
            className="modal d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >
            <div className="modal-backdrop show" />

            <div className="modal-dialog modal-dialog-centered position-relative">
                <div className="modal-content zen-card">
                    <div className="modal-header">
                        <h2 id="confirm-modal-title" className="modal-title h5">
                            {title}
                        </h2>
                    </div>

                    <div className="modal-body">
                        <p className="mb-0">{message}</p>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={onCancel}
                            disabled={busy}
                        >
                            {cancelText}
                        </button>

                        <button
                            type="button"
                            className="btn btn-primary-green"
                            onClick={onConfirm}
                            disabled={busy}
                        >
                            {busy ? "Processing..." : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;