import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ApiError,
    AuthUser,
    createTicket,
    CreatedTicket,
    RequesterIdentity,
    getRelatedSystems,
    getTicketCategories,
    RelatedSystem,
    RequestedPriority,
    TicketReferenceCategory,
    uploadTicketAttachments,
} from "../api.js";
import FormField from "./common/FormField.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import ErrorAlert from "./common/ErrorAlert.js";

interface CreateTicketScreenProps {
    currentRequester: RequesterIdentity & Partial<Pick<AuthUser, "role" | "isActive" | "mustChangePassword">>;
    isSessionCurrent?: () => boolean;
    onCreated: (ticket: CreatedTicket) => void;
    onCancel: () => void;
}

type FieldErrors = {
    categoryId?: string;
    relatedSystemId?: string;
    requestedPriority?: string;
    summary?: string;
    description?: string;
};

type UploadFeedback = { ticket: CreatedTicket; accepted: string[]; rejected: Array<{ filename: string; reason: string }>; uncertain: boolean };
type ConfirmedSubmission = {
    accessKey: string;
    fingerprint: string;
    clientRequestId: string;
    ticket: CreatedTicket;
    originSessionCheck: () => boolean;
    uploadStage: "not-started" | "in-progress" | "complete" | "partial" | "uncertain";
    outcome: UploadFeedback;
};

export const CreateTicketScreen: React.FC<CreateTicketScreenProps> = ({
    currentRequester,
    onCreated,
    onCancel,
    isSessionCurrent = () => true,
}) => {
    const [categories, setCategories] = useState<TicketReferenceCategory[]>([]);
    const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

    const [categoryId, setCategoryId] = useState("");
    const [relatedSystemId, setRelatedSystemId] = useState("");
    const [requestedPriority, setRequestedPriority] =
        useState<RequestedPriority>("Medium");
    const [summary, setSummary] = useState("");
    const [description, setDescription] = useState("");

    const [stagedAttachments, setStagedAttachments] =
        useState<File[]>([]);
    const [attachmentError, setAttachmentError] =
        useState<string | null>(null);

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loadingReferenceData, setLoadingReferenceData] = useState(true);
    const [referenceError, setReferenceError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const pending = useRef(false);
    const requestIntent = useRef<{ fingerprint: string; clientRequestId: string; uncertain: boolean } | null>(null);
    const [uploadOutcome, setUploadOutcome] = useState<UploadFeedback | null>(null);
    // The ref is the synchronous retry boundary; state only renders recovery.
    const confirmedCreation = useRef<ConfirmedSubmission | null>(null);
    const [confirmedView, setConfirmedView] = useState<ConfirmedSubmission | null>(null);
    const rememberConfirmed = (record: ConfirmedSubmission) => {
        confirmedCreation.current = record;
        setConfirmedView(record);
    };
    const outcomeHeading = useRef<HTMLHeadingElement>(null);
    const formHeading = useRef<HTMLHeadingElement>(null);
    const startingNew = useRef(false);
    const referenceGeneration = useRef(0);
    const referencePending = useRef<AbortController | null>(null);
    const accessKey = JSON.stringify([currentRequester.id, currentRequester.role ?? "REQUESTER", currentRequester.isActive ?? true, currentRequester.mustChangePassword ?? false]);
    const accessAllowed = (currentRequester.role ?? "REQUESTER") === "REQUESTER" && currentRequester.isActive !== false && !currentRequester.mustChangePassword;
    const currentAccess = useRef(accessKey);
    currentAccess.current = accessKey;
    const sessionCheck = useRef(isSessionCurrent);
    sessionCheck.current = isSessionCurrent;
    const lifetime = useRef({ active: false, accessKey });
    const [renderAccess, setRenderAccess] = useState(accessKey);
    const submissionGeneration = useRef(0);
    const submissionPending = useRef<AbortController | null>(null);
    const [accessLost, setAccessLost] = useState(false);
    useEffect(() => {
        const changed = lifetime.current.accessKey !== accessKey;
        lifetime.current = { active: accessAllowed, accessKey };
        setRenderAccess(accessKey);
        setAccessLost(false);
        const invalidate = () => {
            lifetime.current.active = false;
            ++submissionGeneration.current;
            submissionPending.current?.abort();
        };
        const clear = () => {
            pending.current = false; requestIntent.current = null;
            confirmedCreation.current = null; setConfirmedView(null);
            setSubmitting(false); setUploadOutcome(null); setSubmitError(null);
            setSummary(""); setDescription(""); setCategoryId(""); setRelatedSystemId("");
            setRequestedPriority("Medium");
            setStagedAttachments([]); setFieldErrors({}); setAttachmentError(null);
        };
        if (changed) clear();
        const loseAccess = () => { invalidate(); clear(); setAccessLost(true); };
        window.addEventListener("session-access-changed", loseAccess);
        return () => { invalidate(); window.removeEventListener("session-access-changed", loseAccess); };
    }, [accessKey, accessAllowed]);

    // A failed logout renders with a fresh current revision, while the original
    // upload stays invalid. Recovery is a new explicit user action, not revival
    // of that obsolete continuation. Never infer that an in-flight batch failed.
    const recoveryOutcome = uploadOutcome ?? (confirmedView?.accessKey === accessKey &&
        !confirmedView.originSessionCheck() && sessionCheck.current() ? confirmedView.outcome : null);
    useEffect(() => {
        if (recoveryOutcome) outcomeHeading.current?.focus();
        else if (startingNew.current) { startingNew.current = false; formHeading.current?.focus(); }
    }, [recoveryOutcome]);

    const summaryCount = summary.length;
    const descriptionCount = description.length;

    const canSubmit = useMemo(
        () => !submitting && !loadingReferenceData,
        [submitting, loadingReferenceData]
    );

    const loadReferenceData = async () => {
        referencePending.current?.abort();
        const controller = new AbortController(); referencePending.current = controller;
        const token = ++referenceGeneration.current;
        const context = { signal: controller.signal, isCurrent: () => token === referenceGeneration.current };
        setLoadingReferenceData(true);
        setReferenceError(null);

        try {
            const [categoryData, systemData] = await Promise.all([
                getTicketCategories(context),
                getRelatedSystems(context),
            ]);

            if (token !== referenceGeneration.current) return;
            setCategories(categoryData);
            setRelatedSystems(systemData);
        } catch {
            if (token !== referenceGeneration.current) return;
            setReferenceError(
                "Unable to load ticket reference data. Please try again."
            );
        } finally {
            if (token === referenceGeneration.current) setLoadingReferenceData(false);
        }
    };

    useEffect(() => {
        loadReferenceData();
        return () => { referencePending.current?.abort(); ++referenceGeneration.current; };
    }, [currentRequester.id]);

    const validate = (): FieldErrors => {
        const errors: FieldErrors = {};

        if (!categoryId) {
            errors.categoryId = "Please select a Category.";
        }

        if (!relatedSystemId) {
            errors.relatedSystemId = "Please select a Related System.";
        }

        const trimmedSummary = summary.trim();
        if (trimmedSummary.length < 5 || trimmedSummary.length > 120) {
            errors.summary =
                "Summary must be between 5 and 120 characters.";
        }

        const trimmedDescription = description.trim();
        if (
            trimmedDescription.length < 10 ||
            trimmedDescription.length > 2000
        ) {
            errors.description =
                "Description must be between 10 and 2000 characters.";
        }

        return errors;
    };

    const handleAttachmentSelection = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles = Array.from(
            event.target.files ?? []
        );

        setAttachmentError(null);

        if (selectedFiles.length === 0) {
            return;
        }

        const combinedFiles = [
            ...stagedAttachments,
            ...selectedFiles,
        ];

        if (combinedFiles.length > 5) {
            setAttachmentError(
                "You can select a maximum of 5 attachments."
            );
            event.target.value = "";
            return;
        }

        setStagedAttachments(combinedFiles);
        event.target.value = "";
    };

    const removeStagedAttachment = (
        indexToRemove: number
    ) => {
        setStagedAttachments((files) =>
            files.filter(
                (_, index) => index !== indexToRemove
            )
        );

        setAttachmentError(null);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }

        return `${(
            bytes /
            (1024 * 1024)
        ).toFixed(1)} MB`;
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!lifetime.current.active || currentAccess.current !== lifetime.current.accessKey || !sessionCheck.current()) return;
        const confirmed = confirmedCreation.current;
        if (confirmed?.accessKey === accessKey) {
            if (!pending.current || !confirmed.originSessionCheck()) setUploadOutcome(confirmed.outcome);
            return;
        }
        if (pending.current || uploadOutcome) return;

        const errors = validate();
        setFieldErrors(errors);
        setSubmitError(null);

        if (Object.keys(errors).length > 0) {
            return;
        }

        const intent = { categoryId: Number(categoryId), relatedSystemId, requestedPriority, summary: summary.trim(), description: description.trim() };
        const fingerprint = JSON.stringify(intent);
        if (requestIntent.current?.uncertain && requestIntent.current.fingerprint !== fingerprint &&
            !window.confirm("The earlier Ticket may already exist. Changed information starts a new Ticket. Continue?")) return;
        if (!requestIntent.current || requestIntent.current.fingerprint !== fingerprint) requestIntent.current = { fingerprint, clientRequestId: crypto.randomUUID(), uncertain: true };
        requestIntent.current.uncertain = true;
        pending.current = true;
        submissionPending.current?.abort();
        const controller = new AbortController(); submissionPending.current = controller;
        const token = ++submissionGeneration.current;
        const originSessionCheck = sessionCheck.current;
        const isCurrent = () => lifetime.current.active && currentAccess.current === accessKey && token === submissionGeneration.current && !controller.signal.aborted && originSessionCheck();
        const context = { signal: controller.signal, isCurrent };
        setSubmitting(true);

        try {
            if (!isCurrent()) return;
            const ticket = await createTicket({
                ...intent,
                clientRequestId: requestIntent.current.clientRequestId,
            }, context);

            if (!isCurrent()) return;

            if (!ticket || typeof ticket.id !== "string" || !ticket.id || typeof ticket.ticketNumber !== "string" || !ticket.ticketNumber) throw new Error("Invalid creation response.");
            const confirmed: ConfirmedSubmission = {
                accessKey, fingerprint, clientRequestId: requestIntent.current!.clientRequestId,
                ticket, originSessionCheck, uploadStage: "not-started",
                outcome: { ticket, accepted: [], rejected: [], uncertain: stagedAttachments.length > 0 },
            };
            rememberConfirmed(confirmed);

            if (stagedAttachments.length > 0) {
                rememberConfirmed({ ...confirmed, uploadStage: "in-progress" });
                try {
                    const result = await uploadTicketAttachments(
                        ticket.id,
                        stagedAttachments, context
                    );
                    if (!isCurrent()) return;
                    const outcome: UploadFeedback = { ticket, accepted: result.accepted.map(file => file.originalFilename), rejected: result.rejected, uncertain: false };
                    rememberConfirmed({ ...confirmed, uploadStage: result.rejected.length ? "partial" : "complete", outcome });
                    if (result.rejected.length) {
                        setUploadOutcome(outcome);
                        return;
                    }
                } catch (error) {
                    if (!isCurrent()) return;
                    const result = error instanceof ApiError ? error.attachmentResult : undefined;
                    const outcome: UploadFeedback = { ticket, accepted: result?.accepted.map(file => file.originalFilename) ?? [], rejected: result?.rejected ?? [], uncertain: !result };
                    rememberConfirmed({ ...confirmed, uploadStage: result ? "partial" : "uncertain", outcome });
                    setUploadOutcome(outcome);
                    return;
                }
            }

            if (isCurrent()) onCreated(ticket);
        } catch (err) {
            if (!isCurrent()) return;
            if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 408 && err.status !== 429 && err.code !== "IDEMPOTENCY_CONFLICT") requestIntent.current = null;
            if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
                setSubmitError(
                    "Some ticket information is invalid. Please review the form and try again."
                );
            } else if (
                err instanceof ApiError &&
                (err.code === "INACTIVE_CATEGORY" ||
                    err.code === "INVALID_CATEGORY" ||
                    err.code === "INACTIVE_RELATED_SYSTEM" ||
                    err.code === "INVALID_RELATED_SYSTEM")
            ) {
                setSubmitError(
                    "One of the selected reference values is no longer available. Please reload and choose again."
                );
            } else {
                setSubmitError(
                    "Unable to submit the ticket right now. Please try again."
                );
            }
        } finally {
            // Only this still-mounted generation may release its pending guard.
            // A failed logout can leave the same form mounted, with an uncertain
            // key that must remain available for an explicit retry.
            if (lifetime.current.active && currentAccess.current === accessKey && token === submissionGeneration.current) { pending.current = false; setSubmitting(false); }
        }
    };

    if (!accessAllowed || accessLost || renderAccess !== accessKey) return <p role="alert">Ticket creation is unavailable for your session or role.</p>;
    if (recoveryOutcome) return <section className="create-ticket-screen zen-card p-4" aria-label="Ticket created with attachment feedback">
        <h1 ref={outcomeHeading} tabIndex={-1} className="h3">Ticket {recoveryOutcome.ticket.ticketNumber} created</h1>
        <p role="status">Ticket created successfully. {recoveryOutcome.uncertain ? "Attachment results could not be confirmed." : `${recoveryOutcome.accepted.length} attachment(s) uploaded; ${recoveryOutcome.rejected.length} failed.`}</p>
        {recoveryOutcome.accepted.length > 0 && <><h2 className="h5">Uploaded files</h2><ul>{recoveryOutcome.accepted.map((name, index) => <li key={index}>{name}</li>)}</ul></>}
        {recoveryOutcome.rejected.length > 0 && <><h2 className="h5">Failed files</h2><ul>{recoveryOutcome.rejected.map((file, index) => <li key={index}>{file.filename}: {file.reason}</li>)}</ul></>}
        <p>{recoveryOutcome.uncertain ? "Review existing attachments before selecting files again; some uploads may already have succeeded. The original upload may still finish." : "Retry only failed files on this existing Ticket. Keep successfully uploaded files."}</p>
        <button className="btn btn-primary-green" onClick={() => { if (lifetime.current.active && currentAccess.current === accessKey && sessionCheck.current()) onCreated(recoveryOutcome.ticket); }}>Open Ticket to review and retry attachments</button>
        <button className="btn btn-outline-secondary ms-2" onClick={() => {
            if (!lifetime.current.active || currentAccess.current !== accessKey || !sessionCheck.current() ||
                !window.confirm("Keep this created Ticket. Review its attachments before retrying files. Clear this draft and start a separate new Ticket?")) return;
            ++submissionGeneration.current; submissionPending.current?.abort(); pending.current = false;
            startingNew.current = true;
            confirmedCreation.current = null; setConfirmedView(null); requestIntent.current = null;
            setUploadOutcome(null); setSubmitting(false); setSubmitError(null); setFieldErrors({});
            setSummary(""); setDescription(""); setCategoryId(""); setRelatedSystemId(""); setRequestedPriority("Medium");
            setStagedAttachments([]); setAttachmentError(null);
        }}>Start a new Ticket</button>
    </section>;

    return (
        <div className="create-ticket-screen">
            <div className="mb-4">
                <h1 ref={formHeading} tabIndex={-1} className="h3 fw-bold text-primary-green mb-1">
                    Create Ticket
                </h1>
                <p className="text-secondary mb-0">
                    Submit a new IT support request.
                </p>
            </div>

            <div className="zen-card p-4 mb-4">
                <h2 className="h5 fw-bold mb-3">
                    System-Generated Information
                </h2>

                <div className="row g-3">
                    <div className="col-12 col-md-6">
                        <div className="small text-secondary">Requester</div>
                        <div className="fw-semibold text-break">
                            {currentRequester.name}
                        </div>
                    </div>

                    <div className="col-12 col-md-6">
                        <div className="small text-secondary">
                            Ticket Number
                        </div>
                        <div className="fw-semibold text-muted">
                            Generated upon submission
                        </div>
                    </div>

                    <div className="col-12 col-md-6">
                        <div className="small text-secondary">Ticket Date</div>
                        <div className="fw-semibold text-muted">
                            Recorded upon submission
                        </div>
                    </div>

                    <div className="col-12 col-md-6">
                        <div className="small text-secondary">
                            Initial Status
                        </div>
                        <div className="fw-semibold">New</div>
                    </div>
                </div>
            </div>

            {referenceError && (
                <ErrorAlert
                    message={referenceError}
                    onRetry={loadReferenceData}
                />
            )}

            {loadingReferenceData ? (
                <LoadingSpinner message="Loading ticket reference data..." />
            ) : (
                <form onSubmit={handleSubmit} noValidate>
                    <div className="zen-card p-4">
                        <div className="row g-3">
                            <div className="col-12 col-md-6">
                                <FormField
                                    id="categoryId"
                                    label="Category"
                                    required
                                    error={fieldErrors.categoryId}
                                >
                                    <select
                                        className="form-select"
                                        value={categoryId}
                                        onChange={(e) => {
                                            setCategoryId(e.target.value);
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                categoryId: undefined,
                                            }));
                                        }}
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map((category) => (
                                            <option
                                                key={category.id}
                                                value={category.id}
                                            >
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>

                            <div className="col-12 col-md-6">
                                <FormField
                                    id="relatedSystemId"
                                    label="Related System"
                                    required
                                    error={fieldErrors.relatedSystemId}
                                >
                                    <select
                                        className="form-select"
                                        value={relatedSystemId}
                                        onChange={(e) => {
                                            setRelatedSystemId(e.target.value);
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                relatedSystemId: undefined,
                                            }));
                                        }}
                                    >
                                        <option value="">
                                            Select Related System
                                        </option>
                                        {relatedSystems.map((system) => (
                                            <option
                                                key={system.id}
                                                value={system.id}
                                            >
                                                {system.name}
                                            </option>
                                        ))}
                                    </select>
                                </FormField>
                            </div>

                            <div className="col-12">
                                <fieldset className="mb-3">
                                    <legend className="form-label fw-semibold">
                                        Requested Priority{" "}
                                        <span
                                            className="text-danger"
                                            aria-hidden="true"
                                        >
                                            *
                                        </span>
                                    </legend>

                                    <div className="d-flex flex-wrap gap-3">
                                        {(
                                            [
                                                "Low",
                                                "Medium",
                                                "High",
                                                "Urgent",
                                            ] as RequestedPriority[]
                                        ).map((priority) => (
                                            <div
                                                className="form-check"
                                                key={priority}
                                            >
                                                <input
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="requestedPriority"
                                                    id={`priority-${priority}`}
                                                    value={priority}
                                                    checked={
                                                        requestedPriority === priority
                                                    }
                                                    onChange={() =>
                                                        setRequestedPriority(priority)
                                                    }
                                                />
                                                <label
                                                    className="form-check-label"
                                                    htmlFor={`priority-${priority}`}
                                                >
                                                    {priority}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>

                            <div className="col-12">
                                <FormField
                                    id="summary"
                                    label="Ticket Summary"
                                    required
                                    helperText={`Summary character count: ${summaryCount} / 120`}
                                    error={fieldErrors.summary}
                                >
                                    <input
                                        type="text"
                                        className="form-control"
                                        maxLength={120}
                                        value={summary}
                                        onChange={(e) => {
                                            setSummary(e.target.value);
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                summary: undefined,
                                            }));
                                        }}
                                        placeholder="Briefly describe the issue"
                                    />
                                </FormField>
                            </div>

                            <div className="col-12">
                                <FormField
                                    id="description"
                                    label="Description"
                                    required
                                    helperText={`Description character count: ${descriptionCount} / 2000`}
                                    error={fieldErrors.description}
                                >
                                    <textarea
                                        className="form-control"
                                        rows={6}
                                        maxLength={2000}
                                        value={description}
                                        onChange={(e) => {
                                            setDescription(e.target.value);
                                            setFieldErrors((prev) => ({
                                                ...prev,
                                                description: undefined,
                                            }));
                                        }}
                                        placeholder="Describe the problem in detail"
                                    />
                                </FormField>
                            </div>

                            <div className="col-12">
                                <div className="zen-card p-3 bg-light">
                                    <div className="fw-semibold mb-1">
                                        Attachments
                                        <span className="text-secondary ms-1">
                                            (Optional)
                                        </span>
                                    </div>

                                    <div className="small text-secondary mb-3">
                                        JPG, PNG, WEBP, or PDF. Maximum
                                        5 MB per file and 5 attachments.
                                    </div>

                                    <label
                                        htmlFor="ticket-attachments"
                                        className="form-label"
                                    >
                                        Select files
                                    </label>

                                    <input
                                        id="ticket-attachments"
                                        type="file"
                                        className="form-control"
                                        multiple
                                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                                        disabled={submitting}
                                        onChange={handleAttachmentSelection}
                                    />

                                    <div className="small text-secondary mt-2">
                                        {stagedAttachments.length} / 5 selected
                                    </div>

                                    {attachmentError && (
                                        <div
                                            className="text-danger small mt-2"
                                            role="alert"
                                        >
                                            {attachmentError}
                                        </div>
                                    )}

                                    {stagedAttachments.length > 0 && (
                                        <div className="mt-3">
                                            {stagedAttachments.map(
                                                (file, index) => (
                                                    <div
                                                        key={`${file.name}-${file.size}-${index}`}
                                                        className="d-flex justify-content-between align-items-center gap-3 border rounded p-2 mb-2 bg-white"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="fw-semibold text-break">
                                                                {file.name}
                                                            </div>

                                                            <div className="small text-secondary">
                                                                {formatFileSize(
                                                                    file.size
                                                                )}
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            disabled={submitting}
                                                            aria-label={`Remove ${file.name}`}
                                                            onClick={() =>
                                                                removeStagedAttachment(
                                                                    index
                                                                )
                                                            }
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {submitError && (
                            <div className="mt-3">
                                <ErrorAlert message={submitError} />
                            </div>
                        )}

                        <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-4">
                            <button
                                type="button"
                                className="btn btn-outline-secondary"
                                onClick={onCancel}
                                disabled={submitting}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="btn btn-primary-green"
                                disabled={!canSubmit}
                            >
                                {submitting
                                    ? "Submitting Ticket..."
                                    : "Submit Ticket"}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
};

export default CreateTicketScreen;
