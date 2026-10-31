import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    ApiError,
    RequesterIdentity,
    getAttachmentContent,
    getTicketDetail,
    removeTicketAttachment,
    TicketAttachment,
    TicketDetail,
    uploadTicketAttachments,
} from "../api.js";
import RequesterDiscussion from "./RequesterDiscussion.js";
import ActionsTaken from "./ActionsTaken.js";
import ErrorAlert from "./common/ErrorAlert.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import StatusBadge from "./common/StatusBadge.js";
import FormField from "./common/FormField.js";
import { useDialogFocus } from "./common/useDialogFocus.js";
import { useMutationContext } from "./common/useMutationContext.js";

interface TicketDetailScreenProps {
    currentRequester: RequesterIdentity;
    ticketId: string;
    onBack: () => void;
    isSessionCurrent?: () => boolean;
}

export const TicketDetailScreen: React.FC<TicketDetailScreenProps> = ({
    currentRequester,
    ticketId,
    onBack,
    isSessionCurrent = () => true,
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
    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

    const [removingAttachment, setRemovingAttachment] =
        useState<TicketAttachment | null>(null);
    const [removalReason, setRemovalReason] = useState("");
    const [removing, setRemoving] = useState(false);
    const [removalError, setRemovalError] = useState<string | null>(null);
    const [attachmentReview, setAttachmentReview] = useState(false);
    const [refreshingAttachments, setRefreshingAttachments] = useState(false);
    const [attachmentRefreshError, setAttachmentRefreshError] = useState<string | null>(null);
    const beginMutation = useMutationContext(currentRequester.id + ":" + ticketId, isSessionCurrent);
    const mutation = useRef<ReturnType<typeof beginMutation> | null>(null);
    const attachmentRefresh = useRef<ReturnType<typeof beginMutation> | null>(null);
    const previewDialog = useRef<HTMLDivElement>(null);
    const removalDialog = useRef<HTMLDivElement>(null);
    const previewTrigger = useRef<HTMLElement | null>(null);
    const removalTrigger = useRef<HTMLElement | null>(null);
    const attachmentsHeading = useRef<HTMLHeadingElement>(null);
    const focusLifetime = useRef(false);
    useLayoutEffect(() => { focusLifetime.current = true; return () => { focusLifetime.current = false; }; }, []);
    const sessionCheck = useRef(isSessionCurrent);
    sessionCheck.current = isSessionCurrent;
    useDialogFocus({ open: !!previewAttachment && !!previewUrl, dialog: previewDialog, trigger: previewTrigger,
        initial: () => previewDialog.current?.querySelector<HTMLElement>("button") ?? null,
        fallback: () => attachmentsHeading.current, onEscape: () => { setPreviewUrl(null); setPreviewAttachment(null); },
        canRestore: () => focusLifetime.current && sessionCheck.current() });
    useDialogFocus({ open: !!removingAttachment, dialog: removalDialog, trigger: removalTrigger,
        initial: () => removalDialog.current?.querySelector<HTMLElement>("textarea") ?? null,
        fallback: () => attachmentsHeading.current, onEscape: () => { if (!removing) { setRemovingAttachment(null); setRemovalReason(""); setRemovalError(null); } },
        canRestore: () => focusLifetime.current && sessionCheck.current() });
    useEffect(() => {
        if (attachmentRefresh.current && !attachmentRefresh.current.context.isCurrent()) {
            attachmentRefresh.current.finish(); attachmentRefresh.current = null; setRefreshingAttachments(false);
        }
        if (mutation.current && !mutation.current.context.isCurrent()) {
            mutation.current.finish(); mutation.current = null;
            setUploading(false); setRemoving(false); setRemovingAttachment(null);
            setAttachmentReview(true); setAttachmentMessage(null);
            setAttachmentError("The earlier attachment request may still finish. Refresh and review existing attachments before selecting files or removing again.");
        }
    }, [isSessionCurrent]);
    const generation = useRef(0);
    const mounted = useRef(true);
    const pendingRead = useRef<AbortController | null>(null);
    const contentGeneration = useRef(0);
    const contentPending = useRef<AbortController | null>(null);

    const loadTicket = async () => {
        if (!mounted.current) return;
        pendingRead.current?.abort(); const controller = new AbortController(); pendingRead.current = controller;
        const token = ++generation.current;
        setLoading(true);
        setNotFound(false);
        setError(null);

        try {
            const data = await getTicketDetail(
                ticketId, { signal: controller.signal, isCurrent: () => mounted.current && token === generation.current }
            );

            if (token !== generation.current) return;
            setTicket(data);
        } catch (err) {
            if (token !== generation.current) return;
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
            if (token === generation.current) setLoading(false);
        }
    };

    useEffect(() => {
        mounted.current = true;
        loadTicket();
        return () => { mounted.current = false; pendingRead.current?.abort(); contentPending.current?.abort(); ++generation.current; ++contentGeneration.current; };
    }, [currentRequester.id, ticketId]);

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

    const refreshTicket = async (isCurrent = () => mounted.current && sessionCheck.current()) => {
        if (!mounted.current) return;
        pendingRead.current?.abort(); const controller = new AbortController(); pendingRead.current = controller;
        const token = ++generation.current;
        const data = await getTicketDetail(
            ticketId, { signal: controller.signal, isCurrent: () => mounted.current && token === generation.current && isCurrent() }
        );

        if (mounted.current && token === generation.current && isCurrent()) setTicket(data);
    };

    const accessFailure = (cause: unknown) => {
        if (!(cause instanceof ApiError) || ![401, 403, 404].includes(cause.status)) return false;
        setTicket(null); setPreviewAttachment(null); setPreviewUrl(null); setRemovingAttachment(null);
        setRemovalReason(""); setRemovalError(null); setAttachmentMessage(null); setAttachmentError(null);
        setError("This ticket is unavailable for your session or role.");
        return true;
    };
    const refreshAttachments = async () => {
        if (attachmentRefresh.current || !sessionCheck.current()) return;
        const request = beginMutation();
        attachmentRefresh.current = request;
        setRefreshingAttachments(true); setAttachmentRefreshError(null);
        try {
            await refreshTicket(request.context.isCurrent);
            if (!request.context.isCurrent()) return;
            setAttachmentReview(false); setAttachmentError(null);
            attachmentsHeading.current?.focus();
        } catch (cause) {
            if (request.context.isCurrent() && !accessFailure(cause)) setAttachmentRefreshError("Unable to refresh attachments. Retry the refresh; do not repeat the original write.");
        } finally {
            request.finish();
            if (request.context.isCurrent() && attachmentRefresh.current === request) { attachmentRefresh.current = null; setRefreshingAttachments(false); }
        }
    };
    const refreshAfterWrite = async (request: ReturnType<typeof beginMutation>) => {
        try { await refreshTicket(request.context.isCurrent); }
        catch (cause) {
            if (request.context.isCurrent() && !accessFailure(cause)) {
                setAttachmentReview(true);
                setAttachmentRefreshError("The attachment write succeeded, but refresh failed. Refresh attachments to review the confirmed change.");
            }
        }
    };

    const handleUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const files = Array.from(event.target.files ?? []);
        const input = event.target;

        if (files.length === 0 || mutation.current || attachmentReview || !sessionCheck.current()) {
            return;
        }

        setUploading(true);
        setAttachmentMessage(null);
        setAttachmentError(null);
        setAttachmentRefreshError(null);
        const request = beginMutation(); mutation.current = request;

        try {
            const result = await uploadTicketAttachments(
                ticketId,
                files, request.context
            );
            if (!request.context.isCurrent()) return;

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

            await refreshAfterWrite(request);
        } catch (err) {
            if (!request.context.isCurrent() || accessFailure(err)) return;
            if (err instanceof ApiError) {
                if (err.attachmentResult) {
                    const result = err.attachmentResult;
                    setAttachmentMessage(`${result.accepted.length} uploaded. ${result.rejected.length} rejected. ${result.rejected.map(item => `${item.filename}: ${item.reason}`).join(" ")}`);
                    await refreshAfterWrite(request);
                } else if (err.status < 500) setAttachmentError(err.message);
                else { setAttachmentReview(true); setAttachmentError("Upload outcome could not be confirmed. Refresh and inspect existing attachments before selecting files again."); }
            } else {
                setAttachmentReview(true); setAttachmentError("Upload outcome could not be confirmed. Refresh and inspect existing attachments before selecting files again.");
            }
        } finally {
            request.finish();
            if (request.context.isCurrent()) { mutation.current = null; setUploading(false); input.value = ""; }
        }
    };

    const openAttachment = async (
        attachment: TicketAttachment,
        inline: boolean
    ) => {
        if (!mounted.current) return;
        contentPending.current?.abort(); const controller = new AbortController(); contentPending.current = controller;
        const token = ++contentGeneration.current;
        setAttachmentError(null);

        try {
            const blob = await getAttachmentContent(
                ticketId,
                attachment.id,
                inline, { signal: controller.signal, isCurrent: () => mounted.current && token === contentGeneration.current }
            );

            if (!mounted.current || token !== contentGeneration.current) return;
            const url = URL.createObjectURL(blob);

            if (inline && attachment.mimeType.startsWith("image/")) {
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
            if (!mounted.current || token !== contentGeneration.current) return;
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
        setPreviewUrl(null);
        setPreviewAttachment(null);
    };

    const confirmRemoval = async () => {
        if (!removingAttachment || mutation.current || attachmentReview || !sessionCheck.current()) {
            return;
        }

        const trimmedReason = removalReason.trim();

        if (
            trimmedReason.length < 1 ||
            trimmedReason.length > 200
        ) {
            setRemovalError(
                "Removal reason must be between 1 and 200 characters."
            );
            document.getElementById("attachment-removal-reason")?.focus();
            return;
        }

        setRemoving(true);
        setAttachmentError(null);
        setRemovalError(null); setAttachmentRefreshError(null);
        const request = beginMutation(); mutation.current = request;

        try {
            const removed = await removeTicketAttachment(
                ticketId,
                removingAttachment.id,
                trimmedReason, request.context
            );
            if (!request.context.isCurrent()) return;

            // A confirmed removal is already authoritative. Remove its trigger
            // before dialog cleanup so focus falls back to the stable heading.
            setTicket(previous => previous ? { ...previous, activeAttachments: previous.activeAttachments.filter(item => item.id !== removingAttachment.id), removedAttachments: [...previous.removedAttachments.filter(item => item.id !== removed.id), removed] } : previous);

            setRemovingAttachment(null);
            setRemovalReason("");
            setAttachmentMessage(
                "Attachment removed successfully."
            );

            await refreshAfterWrite(request);
        } catch (err) {
            if (!request.context.isCurrent() || accessFailure(err)) return;
            if (err instanceof ApiError && err.status < 500) {
                setRemovalError(err.message);
                if (err.status === 400 && err.code === "VALIDATION_ERROR") requestAnimationFrame(() => {
                    if (request.context.isCurrent()) removalDialog.current?.querySelector<HTMLElement>("textarea")?.focus();
                });
            } else {
                setAttachmentReview(true);
                setRemovingAttachment(null);
                setAttachmentError("Removal outcome could not be confirmed. Refresh and inspect existing attachments before removing again.");
            }
        } finally {
            request.finish(); if (request.context.isCurrent()) { mutation.current = null; setRemoving(false); }
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
                            ref={attachmentsHeading}
                            tabIndex={-1}
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
                            className={`btn btn-primary-green attachment-upload ${uploading || removing || attachmentReview || refreshingAttachments ? "disabled" : ""
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
                                disabled={uploading || removing || attachmentReview || refreshingAttachments}
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
                {(attachmentReview || attachmentRefreshError) && <div className="mb-3">
                    {attachmentRefreshError && <p role="alert">{attachmentRefreshError}</p>}
                    <button className="btn btn-outline-primary-green" disabled={refreshingAttachments} onClick={() => void refreshAttachments()}>{refreshingAttachments ? "Refreshing attachments..." : "Refresh attachments for review"}</button>
                    {refreshingAttachments && <p role="status">Refreshing existing attachments; the original write is not repeated.</p>}
                </div>}

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
                                                            onClick={event => {
                                                                previewTrigger.current = event.currentTarget;
                                                                void openAttachment(
                                                                    attachment,
                                                                    true
                                                                );
                                                            }}
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
                                                    className="btn btn-sm btn-outline-primary-green"
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
                                                    disabled={uploading || removing || attachmentReview || refreshingAttachments}
                                                    onClick={event => {
                                                        removalTrigger.current = event.currentTarget;
                                                        setRemovingAttachment(
                                                            attachment
                                                        );
                                                        setRemovalReason("");
                                                        setAttachmentError(null);
                                                        setRemovalError(null);
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

                <ActionsTaken key={currentRequester.id + ticket.id} ticketId={ticket.id}/>
                <RequesterDiscussion key={ticket.id} ticketId={ticket.id} resolvedAt={ticket.problemAppearsResolvedAt} isSessionCurrent={isSessionCurrent}/>

            {previewAttachment && previewUrl && (
                    <div
                        className="modal d-block"
                        tabIndex={-1}
                        role="dialog"
                        ref={previewDialog}
                        aria-modal="true"
                        aria-labelledby="attachment-preview-title"
                        aria-describedby="attachment-preview-description"
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
                                    <p id="attachment-preview-description" className="visually-hidden">Image attachment preview. Close preview to return to attachments.</p>
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
                        ref={removalDialog}
                        aria-modal="true"
                        aria-labelledby="remove-attachment-title"
                        aria-describedby="remove-attachment-description"
                        aria-busy={removing}
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
                                    <p id="remove-attachment-description">
                                        Remove{" "}
                                        <strong>
                                            {
                                                removingAttachment.originalFilename
                                            }
                                        </strong>
                                        ?
                                    </p>

                                    <FormField id="attachment-removal-reason" label="Removal reason" error={removalError ?? undefined} helperText={`${removalReason.length} / 200`}>
                                    <textarea
                                        id="attachment-removal-reason"
                                        className="form-control"
                                        maxLength={200}
                                        rows={3}
                                        required
                                        value={removalReason}
                                        disabled={removing}
                                        onChange={(event) => {
                                            setRemovalError(null);
                                            setRemovalReason(
                                                event.target.value
                                            );
                                        }}
                                    />
                                    </FormField>
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
                                                removing || attachmentReview ||
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
