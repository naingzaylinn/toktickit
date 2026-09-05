import React, { useEffect, useMemo, useState } from "react";
import {
    ApiError,
    createTicket,
    CreatedTicket,
    DevelopmentRequester,
    getRelatedSystems,
    getTicketCategories,
    RelatedSystem,
    RequestedPriority,
    TicketReferenceCategory,
} from "../api.js";
import FormField from "./common/FormField.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import ErrorAlert from "./common/ErrorAlert.js";

interface CreateTicketScreenProps {
    currentRequester: DevelopmentRequester;
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

export const CreateTicketScreen: React.FC<CreateTicketScreenProps> = ({
    currentRequester,
    onCreated,
    onCancel,
}) => {
    const [categories, setCategories] = useState<TicketReferenceCategory[]>([]);
    const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

    const [categoryId, setCategoryId] = useState("");
    const [relatedSystemId, setRelatedSystemId] = useState("");
    const [requestedPriority, setRequestedPriority] =
        useState<RequestedPriority>("Medium");
    const [summary, setSummary] = useState("");
    const [description, setDescription] = useState("");

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [loadingReferenceData, setLoadingReferenceData] = useState(true);
    const [referenceError, setReferenceError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const summaryCount = summary.length;
    const descriptionCount = description.length;

    const canSubmit = useMemo(
        () => !submitting && !loadingReferenceData,
        [submitting, loadingReferenceData]
    );

    const loadReferenceData = async () => {
        setLoadingReferenceData(true);
        setReferenceError(null);

        try {
            const [categoryData, systemData] = await Promise.all([
                getTicketCategories(currentRequester.id),
                getRelatedSystems(currentRequester.id),
            ]);

            setCategories(categoryData);
            setRelatedSystems(systemData);
        } catch {
            setReferenceError(
                "Unable to load ticket reference data. Please try again."
            );
        } finally {
            setLoadingReferenceData(false);
        }
    };

    useEffect(() => {
        loadReferenceData();
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

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        const errors = validate();
        setFieldErrors(errors);
        setSubmitError(null);

        if (Object.keys(errors).length > 0) {
            return;
        }

        setSubmitting(true);

        try {
            const ticket = await createTicket(currentRequester.id, {
                categoryId: Number(categoryId),
                relatedSystemId,
                requestedPriority,
                summary: summary.trim(),
                description: description.trim(),
                clientRequestId: crypto.randomUUID(),
            });

            onCreated(ticket);
        } catch (err) {
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
            setSubmitting(false);
        }
    };

    return (
        <div className="create-ticket-screen">
            <div className="mb-4">
                <h1 className="h3 fw-bold text-primary-green mb-1">
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
                        <div className="fw-semibold">
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
                                    <div className="small text-secondary">
                                        Attachment upload will be available in
                                        Feature-G. You can create the ticket now
                                        without attachments.
                                    </div>
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