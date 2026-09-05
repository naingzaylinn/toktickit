import React, { useEffect, useState } from "react";
import {
    ApiError,
    DevelopmentRequester,
    getTicketDetail,
    TicketDetail,
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

    const formatDateTime = (value: string) => {
        return new Date(value).toLocaleString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });
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
                <h2
                    id="attachments-heading"
                    className="h5 fw-bold mb-3"
                >
                    Attachments
                </h2>

                <p className="text-secondary mb-0">
                    Attachment management will be available in Feature-G.
                </p>
            </section>
        </div>
    );
};

export default TicketDetailScreen;