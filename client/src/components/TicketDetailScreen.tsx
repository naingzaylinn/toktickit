import React, { useEffect, useState } from "react";
import {
    ApiError,
    DevelopmentRequester,
    getAttachmentContent,
    getTicketDetail,
    removeTicketAttachment,
    TicketAttachment,
    TicketDetail,
    uploadTicketAttachments,
} from "../api.js";
import ErrorAlert from "./common/ErrorAlert.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import StatusBadge from "./common/StatusBadge.js";

interface TicketDetailScreenProps {
    currentRequester: DevelopmentRequester;
    ticketId: string;
    onBack: () => void;
}

export const TicketDetailScreen: React.FC<TicketDetailScreenProps> = ({
    currentRequester,
    ticketId,
    onBack,
}) => {
    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [uploading, setUploading] = useState(false);
    const [attachmentMessage, setAttachmentMessage] =
        useState<string | null>(null);
    const [attachmentError, setAttachmentError] =
        useState<string | null>(null);

    const [previewAttachment, setPreviewAttachment] =
        useState<TicketAttachment | null>(null);
    const [previewUrl, setPreviewUrl] =
        useState<string | null>(null);

    const [removingAttachment, setRemovingAttachment] =
        useState<TicketAttachment | null>(null);
    const [removalReason, setRemovalReason] = useState("");
    const [removing, setRemoving] = useState(false);

    const loadTicket = async () => {
        setLoading(true);
        setNotFound(false);
        setError(null);

        try {
            const data = await getTicketDetail(
                currentRequester.id,
                ticketId
            );

            setTicket(data);
        } catch (err) {
            if (
                err instanceof ApiError &&
                err.status === 404 &&
                err.code === "TICKET_NOT_FOUND"
            ) {
                setTicket(null);
                setNotFound(true);
            } else {
                setTicket(null);
                setError(
                    "Unable to load this ticket right now. Please try again."
                );
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTicket();
    }, [currentRequester.id, ticketId]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") {
                return;
            }

            if (previewAttachment) {
                closePreview();
            }

            if (removingAttachment && !removing) {
                setRemovingAttachment(null);
                setRemovalReason("");
            }
        };

        document.addEventListener("keydown", handleEscape);

        return () => {
            document.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, [
        previewAttachment,
        previewUrl,
        removingAttachment,
        removing,
    ]);

    const formatDateTime = (value: string) => {
        return new Date(value).toLocaleString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const refreshTicket = async () => {
        const data = await getTicketDetail(
            currentRequester.id,
            ticketId
        );

        setTicket(data);
    };

    const handleUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = Array.from(event.target.files ?? []);

        if (files.length === 0) {
            return;
        }

        setUploading(true);
        setAttachmentMessage(null);
        setAttachmentError(null);

        try {
            const result = await uploadTicketAttachments(
                currentRequester.id,
                ticketId,
                files
            );

            const acceptedCount = result.accepted.length;
            const rejectedCount = result.rejected.length;

            if (rejectedCount === 0) {
                setAttachmentMessage(
                    `${acceptedCount} attachment${acceptedCount === 1 ? "" : "s"
                    } uploaded successfully.`
                );
            } else {
                const rejectedNames = result.rejected
                    .map(
                        (item) =>
                            `${item.filename}: ${item.reason}`
                    )
                    .join(" ");

                setAttachmentMessage(
                    `${acceptedCount} uploaded. ${rejectedCount} rejected. ${rejectedNames}`
                );
            }

            await refreshTicket();
        } catch (err) {
            if (err instanceof ApiError) {
                setAttachmentError(err.message);
            } else {
                setAttachmentError(
                    "Unable to upload attachments."
                );
            }
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    };

    const openAttachment = async (
        attachment: TicketAttachment,
        inline: boolean
    ) => {
        setAttachmentError(null);

        try {
            const blob = await getAttachmentContent(
                currentRequester.id,
                ticketId,
                attachment.id,
                inline
            );

            const url = URL.createObjectURL(blob);

            if (inline && attachment.mimeType.startsWith("image/")) {
                if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                }

                setPreviewAttachment(attachment);
                setPreviewUrl(url);
                return;
            }

            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = inline
                ? ""
                : attachment.originalFilename;
            anchor.target = inline ? "_blank" : "_self";

            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();

            window.setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
        } catch (err) {
            if (err instanceof ApiError) {
                setAttachmentError(err.message);
            } else {
                setAttachmentError(
                    "Unable to open attachment."
                );
            }
        }
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(null);
        setPreviewAttachment(null);
    };

    const confirmRemoval = async () => {
        if (!removingAttachment) {
            return;
        }

        const trimmedReason = removalReason.trim();

        if (
            trimmedReason.length < 1 ||
            trimmedReason.length > 200
        ) {
            setAttachmentError(
                "Removal reason must be between 1 and 200 characters."
            );
            return;
        }

        setRemoving(true);
        setAttachmentError(null);

        try {
            await removeTicketAttachment(
                currentRequester.id,
                ticketId,
                removingAttachment.id,
                trimmedReason
            );

            setRemovingAttachment(null);
            setRemovalReason("");
            setAttachmentMessage(
                "Attachment removed successfully."
            );

            await refreshTicket();
        } catch (err) {
            if (err instanceof ApiError) {
                setAttachmentError(err.message);
            } else {
                setAttachmentError(
                    "Unable to remove attachment."
                );
            }
        } finally {
            setRemoving(false);
        }
    };

    if (loading) {
        return (
            <LoadingSpinner message="Loading ticket details..." />
        );
    }

    if (notFound) {
        return (
            <div className="zen-card p-4 p-md-5 text-center">
                <h1 className="h3 fw-bold text-primary-green mb-3">
                    Ticket Not Found
                </h1>

                <p className="text-secondary mb-4">
                    The requested ticket does not exist or you do not have
                    permission to view it.
                </p>

                <button
                    type="button"
                    className="btn btn-primary-green"
                    onClick={onBack}
                >
                    ← Return to My Tickets
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <button
                    type="button"
                    className="btn btn-link px-0 mb-3 text-primary-green"
                    onClick={onBack}
                >
                    ← Back to My Tickets
                </button>

                <ErrorAlert
                    message={error}
                    onRetry={loadTicket}
                />
            </div>
        );
    }

    if (!ticket) {
        return null;
    }

    return (
        <div className="ticket-detail-screen">
            <button
                type="button"
                className="btn btn-link px-0 mb-3 text-primary-green"
                onClick={onBack}
            >
                ← Back to My Tickets
            </button>

            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
                <div>
                    <h1 className="h3 fw-bold text-primary-green mb-1">
                        Ticket {ticket.ticketNumber}
                    </h1>

                    <p className="text-secondary mb-0">
                        Submitted on {formatDateTime(ticket.ticketDate)}
                    </p>
                </div>

                <StatusBadge
                    label={ticket.currentStatus}
                    variant="info"
                />
            </div>

            <section
                className="zen-card p-4 mb-4"
                aria-labelledby="ticket-overview-heading"
            >
                <h2
                    id="ticket-overview-heading"
                    className="h5 fw-bold mb-4"
                >
                    Ticket Overview
                </h2>

                <dl className="row mb-0">
                    <dt className="col-12 col-md-4 mb-1 mb-md-3">
                        Requester
                    </dt>
                    <dd className="col-12 col-md-8 mb-3">
                        <div className="fw-semibold">
                            {ticket.requester.name}
                        </div>
                        <div className="text-secondary small">
                            {ticket.requester.email}
                        </div>
                    </dd>

                    <dt className="col-12 col-md-4 mb-1 mb-md-3">
                        Category
                    </dt>
                    <dd className="col-12 col-md-8 mb-3">
                        <span>{ticket.category.name}</span>

                        {!ticket.category.isActive && (
                            <span className="badge text-bg-secondary ms-2">
                                Inactive
                            </span>
                        )}
                    </dd>

                    <dt className="col-12 col-md-4 mb-1 mb-md-3">
                        Related System
                    </dt>
                    <dd className="col-12 col-md-8 mb-3">
                        <span>{ticket.relatedSystem.name}</span>

                        {!ticket.relatedSystem.isActive && (
                            <span className="badge text-bg-secondary ms-2">
                                Inactive
                            </span>
                        )}
                    </dd>

                    <dt className="col-12 col-md-4 mb-1 mb-md-3">
                        Requested Priority
                    </dt>
                    <dd className="col-12 col-md-8 mb-3">
                        <StatusBadge
                            label={ticket.requestedPriority}
                            variant={
                                ticket.requestedPriority === "Urgent"
                                    ? "danger"
                                    : ticket.requestedPriority === "High"
                                        ? "warning"
                                        : ticket.requestedPriority === "Medium"
                                            ? "info"
                                            : "success"
                            }
                        />
                    </dd>

                    <dt className="col-12 col-md-4 mb-1">
                        Status
                    </dt>
                    <dd className="col-12 col-md-8 mb-0">
                        <StatusBadge
                            label={ticket.currentStatus}
                            variant="info"
                        />
                    </dd>
                </dl>
            </section>

            <section
                className="zen-card p-4 mb-4"
                aria-labelledby="problem-details-heading"
            >
                <h2
                    id="problem-details-heading"
                    className="h5 fw-bold mb-4"
                >
                    Problem Details
                </h2>

                <div className="mb-4">
                    <div className="fw-semibold mb-2">
                        Summary
                    </div>

                    <div className="text-break">
                        {ticket.summary}
                    </div>
                </div>

                <div>
                    <div className="fw-semibold mb-2">
                        Description
                    </div>

                    <div
                        className="text-break"
                        style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                        }}
                    >
                        {ticket.description}
                    </div>
                </div>
            </section>

            <section
                className="zen-card p-4"
                aria-labelledby="attachments-heading"
            >
                <div className="d-flex flex-column flex-md-row justify-content-between gap-3 mb-3">
                    <div>
                        <h2
                            id="attachments-heading"
                            className="h5 fw-bold mb-1"
                        >
                            Attachments
                        </h2>

                        <p className="text-secondary small mb-0">
                            JPG, PNG, WEBP, or PDF. Maximum 5 MB per file.
                            Maximum 5 active attachments.
                        </p>
                    </div>

                    <div>
                        <label
                            className={`btn btn-primary-green ${uploading ? "disabled" : ""
                                }`}
                        >
                            {uploading
                                ? "Uploading..."
                                : "+ Upload Attachment"}

                            <input
                                type="file"
                                className="visually-hidden"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                                disabled={uploading}
                                onChange={handleUpload}
                            />
                        </label>
                    </div>
                </div>

                <div className="mb-3 text-secondary">
                    {ticket.activeAttachments.length} / 5 active
                </div>

                {attachmentMessage && (
                    <div
                        className="alert alert-success"
                        role="status"
                    >
                        {attachmentMessage}
                    </div>
                )}

                {attachmentError && (
                    <ErrorAlert
                        message={attachmentError}
                        title="Attachment Error"
                    />
                )}

                <div className="mb-4">
                    <h3 className="h6 fw-bold mb-3">
                        Active Attachments
                    </h3>

                    {ticket.activeAttachments.length === 0 ? (
                        <p className="text-secondary mb-0">
                            No active attachments.
                        </p>
                    ) : (
                        <div className="d-flex flex-column gap-3">
                            {ticket.activeAttachments.map(
                                (attachment) => (
                                    <div
                                        key={attachment.id}
                                        className="border rounded p-3"
                                    >
                                        <div className="d-flex flex-column flex-md-row justify-content-between gap-3">
                                            <div className="min-w-0">
                                                <div className="fw-semibold text-break">
                                                    {attachment.originalFilename}
                                                </div>

                                                <div className="small text-secondary">
                                                    {formatFileSize(
                                                        attachment.sizeBytes
                                                    )}{" "}
                                                    · Uploaded{" "}
                                                    {formatDateTime(
                                                        attachment.createdAt
                                                    )}
                                                </div>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2">
                                                {attachment.mimeType.startsWith(
                                                    "image/"
                                                ) && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            onClick={() =>
                                                                openAttachment(
                                                                    attachment,
                                                                    true
                                                                )
                                                            }
                                                        >
                                                            Preview
                                                        </button>
                                                    )}

                                                {attachment.mimeType ===
                                                    "application/pdf" && (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            onClick={() =>
                                                                openAttachment(
                                                                    attachment,
                                                                    true
                                                                )
                                                            }
                                                        >
                                                            Open
                                                        </button>
                                                    )}

                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() =>
                                                        openAttachment(
                                                            attachment,
                                                            false
                                                        )
                                                    }
                                                >
                                                    Download
                                                </button>

                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => {
                                                        setRemovingAttachment(
                                                            attachment
                                                        );
                                                        setRemovalReason("");
                                                        setAttachmentError(null);
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="h6 fw-bold mb-3">
                        Removed Attachments (History)
                    </h3>

                    {ticket.removedAttachments.length === 0 ? (
                        <p className="text-secondary mb-0">
                            No removed attachments.
                        </p>
                    ) : (
                        <div className="d-flex flex-column gap-3">
                            {ticket.removedAttachments.map(
                                (attachment) => (
                                    <div
                                        key={attachment.id}
                                        className="border rounded p-3 bg-light"
                                    >
                                        <div className="fw-semibold text-break">
                                            {attachment.originalFilename}
                                        </div>

                                        <div className="small text-secondary mb-2">
                                            {formatFileSize(
                                                attachment.sizeBytes
                                            )}
                                            {attachment.removedAt &&
                                                ` · Removed ${formatDateTime(
                                                    attachment.removedAt
                                                )}`}
                                        </div>

                                        {attachment.removalReason && (
                                            <div>
                                                <span className="fw-semibold">
                                                    Reason:
                                                </span>{" "}
                                                {attachment.removalReason}
                                            </div>
                                        )}
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>

                {previewAttachment && previewUrl && (
                    <div
                        className="modal d-block"
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="attachment-preview-title"
                        style={{
                            backgroundColor:
                                "rgba(0, 0, 0, 0.5)",
                        }}
                    >
                        <div className="modal-dialog modal-lg modal-dialog-centered">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h2
                                        id="attachment-preview-title"
                                        className="modal-title h5"
                                    >
                                        {previewAttachment.originalFilename}
                                    </h2>

                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Close preview"
                                        onClick={closePreview}
                                    />
                                </div>

                                <div className="modal-body text-center">
                                    <img
                                        src={previewUrl}
                                        alt={
                                            previewAttachment.originalFilename
                                        }
                                        className="img-fluid"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {removingAttachment && (
                    <div
                        className="modal d-block"
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="remove-attachment-title"
                        style={{
                            backgroundColor:
                                "rgba(0, 0, 0, 0.5)",
                        }}
                    >
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h2
                                        id="remove-attachment-title"
                                        className="modal-title h5"
                                    >
                                        Remove Attachment
                                    </h2>

                                    <button
                                        type="button"
                                        className="btn-close"
                                        aria-label="Cancel removal"
                                        disabled={removing}
                                        onClick={() => {
                                            setRemovingAttachment(null);
                                            setRemovalReason("");
                                        }}
                                    />
                                </div>

                                <div className="modal-body">
                                    <p>
                                        Remove{" "}
                                        <strong>
                                            {
                                                removingAttachment.originalFilename
                                            }
                                        </strong>
                                        ?
                                    </p>

                                    <label
                                        htmlFor="attachment-removal-reason"
                                        className="form-label fw-semibold"
                                    >
                                        Removal reason
                                    </label>

                                    <textarea
                                        id="attachment-removal-reason"
                                        className="form-control"
                                        maxLength={200}
                                        rows={3}
                                        value={removalReason}
                                        disabled={removing}
                                        onChange={(event) =>
                                            setRemovalReason(
                                                event.target.value
                                            )
                                        }
                                    />

                                    <div className="form-text">
                                        {removalReason.length} / 200
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        disabled={removing}
                                        onClick={() => {
                                            setRemovingAttachment(null);
                                            setRemovalReason("");
                                        }}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        disabled={
                                            removing ||
                                            removalReason.trim().length === 0
                                        }
                                        onClick={confirmRemoval}
                                    >
                                        {removing
                                            ? "Removing..."
                                            : "Remove Attachment"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default TicketDetailScreen;