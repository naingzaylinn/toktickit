import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    getStaffTickets,
    ApiError,
    AuthUser,
    StaffTicketOrder,
    StaffTicketPriority,
    StaffTicketQueueItem,
    StaffTicketQueueMeta,
    StaffTicketQueueQuery,
    StaffTicketSort,
    StaffTicketStatus,
} from "../api.js";
import EmptyState from "./common/EmptyState.js";
import ErrorAlert from "./common/ErrorAlert.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import StatusBadge from "./common/StatusBadge.js";

interface StaffTicketQueueScreenProps {
    onOpenTicket: (ticketId: string) => void;
    currentUser?: AuthUser;
}

const DEFAULT_META: StaffTicketQueueMeta = {
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
};

const STATUS_OPTIONS: Array<{
    value: StaffTicketStatus;
    label: string;
}> = [
    { value: "NEW", label: "New" },
    { value: "OPEN", label: "Open" },
    { value: "IN_PROGRESS", label: "In Progress" },
    {
        value: "WAITING_FOR_REQUESTER",
        label: "Waiting for Requester",
    },
    { value: "RESOLVED", label: "Resolved" },
    { value: "CLOSED", label: "Closed" },
    { value: "REOPENED", label: "Reopened" },
    { value: "CANCELLED", label: "Cancelled" },
];

const PRIORITY_OPTIONS: Array<{
    value: StaffTicketPriority;
    label: string;
}> = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
];

function statusLabel(status: StaffTicketStatus): string {
    return (
        STATUS_OPTIONS.find((option) => option.value === status)?.label ??
        status
    );
}

function priorityLabel(priority: StaffTicketPriority): string {
    return (
        PRIORITY_OPTIONS.find(
            (option) => option.value === priority
        )?.label ?? priority
    );
}

function priorityVariant(
    priority: StaffTicketPriority
): "success" | "warning" | "danger" | "info" | "neutral" {
    switch (priority) {
        case "LOW":
            return "success";
        case "MEDIUM":
            return "info";
        case "HIGH":
            return "warning";
        case "URGENT":
            return "danger";
        default:
            return "neutral";
    }
}

function statusVariant(
    status: StaffTicketStatus
): "success" | "warning" | "danger" | "info" | "neutral" {
    switch (status) {
        case "RESOLVED":
        case "CLOSED":
            return "success";

        case "WAITING_FOR_REQUESTER":
            return "warning";

        case "CANCELLED":
            return "danger";

        case "NEW":
        case "OPEN":
        case "IN_PROGRESS":
        case "REOPENED":
            return "info";

        default:
            return "neutral";
    }
}

export const StaffTicketQueueScreen: React.FC<
    StaffTicketQueueScreenProps
> = ({ onOpenTicket, currentUser }) => {
    const initial = useRef(new URLSearchParams(window.location.search)).current;
    const [tickets, setTickets] = useState<StaffTicketQueueItem[]>([]);
    const [meta, setMeta] =
        useState<StaffTicketQueueMeta>(DEFAULT_META);

    const [searchInput, setSearchInput] = useState(initial.get("search") ?? "");
    const [debouncedSearch, setDebouncedSearch] = useState(initial.get("search") ?? "");

    const [status, setStatus] = useState(initial.get("status") ?? "");
    const [statusGroup, setStatusGroup] = useState(initial.get("statusGroup") ?? "");
    const [requestedPriority, setRequestedPriority] = useState(initial.get("requestedPriority") ?? "");
    const [itPriority, setItPriority] = useState(initial.get("itPriority") ?? "");
    const [owner, setOwner] = useState(initial.get("owner") ?? "");

    const [sort, setSort] =
        useState<StaffTicketSort>((initial.get("sort") as StaffTicketSort) || "updatedAt");
    const [order, setOrder] =
        useState<StaffTicketOrder>((initial.get("order") as StaffTicketOrder) || "desc");

    const [page, setPage] = useState(Number(initial.get("page") ?? 1));
    const [pageSize, setPageSize] =
        useState<10 | 20 | 50>(Number(initial.get("pageSize") ?? 20) as 10 | 20 | 50);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const generation = useRef(0);
    const skipUrlSync = useRef(true);
    const ownNavigation = useRef(false);
    const [denied, setDenied] = useState(false);
    const [routeRevision, setRouteRevision] = useState(0);

    const hasActiveFilters =
        debouncedSearch.length > 0 ||
        status !== "" ||
        statusGroup !== "" ||
        requestedPriority !== "" ||
        itPriority !== "" ||
        owner !== "";

    const query = useMemo<StaffTicketQueueQuery>(
        () => ({
            search: debouncedSearch || undefined,
            status:
                (status as StaffTicketStatus) || undefined,
            statusGroup: (statusGroup as "active") || undefined,
            requestedPriority:
                (requestedPriority as StaffTicketPriority) ||
                undefined,
            itPriority:
                (itPriority as StaffTicketPriority) || undefined,
            owner: owner || undefined,
            sort,
            order,
            page,
            pageSize,
        }),
        [
            debouncedSearch,
            status,
            statusGroup,
            requestedPriority,
            itPriority,
            owner,
            sort,
            order,
            page,
            pageSize,
            routeRevision,
        ]
    );

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (searchInput.trim() !== debouncedSearch) setPage(1);
            setDebouncedSearch(searchInput.trim());
        }, 300);

        return () => window.clearTimeout(timer);
    }, [searchInput, debouncedSearch]);

    const loadTickets = async () => {
        const token = ++generation.current;
        setLoading(true);
        setError(null);

        try {
            const response = await getStaffTickets(query);
            if (token !== generation.current) return;
            setTickets(response.data);
            setMeta(response.meta);
        } catch (cause) {
            if (token !== generation.current) return;
            setTickets([]);
            if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
                ++generation.current; setDenied(true); setLoading(false);
                setError("The Ticket Queue is unavailable for your session or role."); return;
            }
            setError(
                "Unable to load the staff ticket queue right now. Please try again."
            );
        } finally {
            if (token === generation.current) setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
        return () => { ++generation.current; };
    }, [query]);

    useEffect(() => {
        if (skipUrlSync.current) { skipUrlSync.current = false; return; }
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || key === "page" && value === 1 || key === "pageSize" && value === 20 ||
                key === "sort" && value === "updatedAt" || key === "order" && value === "desc") continue;
            params.set(key, String(value));
        }
        const search = params.size ? "?" + params.toString() : "";
        if (window.location.search !== search) {
            ownNavigation.current = true;
            window.history.pushState({}, "", window.location.pathname + search);
            window.dispatchEvent(new PopStateEvent("popstate"));
            ownNavigation.current = false;
        }
    }, [query]);
    useEffect(() => {
        const restore = () => {
            if (ownNavigation.current || !["/staff/tickets", "/", "/login"].includes(window.location.pathname)) return;
            const params = new URLSearchParams(window.location.search);
            skipUrlSync.current = true; ++generation.current;
            setRouteRevision(value => value + 1);
            setSearchInput(params.get("search") ?? ""); setDebouncedSearch(params.get("search") ?? "");
            setStatus(params.get("status") ?? ""); setStatusGroup(params.get("statusGroup") ?? "");
            setRequestedPriority(params.get("requestedPriority") ?? ""); setItPriority(params.get("itPriority") ?? "");
            setOwner(params.get("owner") ?? ""); setSort((params.get("sort") as StaffTicketSort) || "updatedAt");
            setOrder((params.get("order") as StaffTicketOrder) || "desc"); setPage(Number(params.get("page") ?? 1));
            setPageSize(Number(params.get("pageSize") ?? 20) as 10 | 20 | 50);
        };
        const clear = () => { ++generation.current; setTickets([]); setDenied(true); setLoading(false); };
        window.addEventListener("popstate", restore); window.addEventListener("session-access-changed", clear);
        return () => { ++generation.current; window.removeEventListener("popstate", restore); window.removeEventListener("session-access-changed", clear); };
    }, []);

    const resetToPageOne = () => {
        setPage(1);
    };

    const clearFilters = () => {
        setSearchInput("");
        setDebouncedSearch("");
        setStatus("");
        setStatusGroup("");
        setRequestedPriority("");
        setItPriority("");
        setOwner("");
        setPage(1);
    };

    const resetQueue = () => {
        clearFilters();
        setSort("updatedAt");
        setOrder("desc");
        setPageSize(20);
    };

    const formatDate = (value: string) =>
        new Date(value).toLocaleDateString();

    const formatDateTime = (value: string) =>
        new Date(value).toLocaleString();

    if (denied) return <p role="alert">The Ticket Queue is unavailable for your session or role.</p>;

    return (
        <div
            className="staff-ticket-queue-screen"
            data-testid="staff-ticket-queue"
        >
            <div className="mb-4">
                <h1 className="h3 fw-bold text-primary-green mb-1">
                    Ticket Queue
                </h1>

                <p className="text-secondary mb-0">
                    Search, filter, sort, and review IT support
                    tickets.
                </p>
            </div>

            <div className="zen-card p-3 p-md-4 mb-4">
                <div className="row g-3">
                    <div className="col-12 col-md-6"><label htmlFor="staff-status-group" className="form-label fw-semibold">Status group</label>
                        <select id="staff-status-group" className="form-select" value={statusGroup} onChange={e => { setStatusGroup(e.target.value); resetToPageOne(); }}>
                            <option value="">All statuses</option><option value="active">Active Tickets</option>
                        </select>
                    </div>
                    <div className="col-12">
                        <label
                            htmlFor="staff-ticket-search"
                            className="form-label fw-semibold"
                        >
                            Search
                        </label>

                        <input
                            id="staff-ticket-search"
                            type="search"
                            className="form-control"
                            placeholder="Search Ticket Number, Summary, Requester Name, or Requester Email"
                            value={searchInput}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-status-filter"
                            className="form-label fw-semibold"
                        >
                            Status
                        </label>

                        <select
                            id="staff-status-filter"
                            className="form-select"
                            value={status}
                            onChange={(event) => {
                                setStatus(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">All Statuses</option>

                            {STATUS_OPTIONS.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-requested-priority-filter"
                            className="form-label fw-semibold"
                        >
                            Requested Priority
                        </label>

                        <select
                            id="staff-requested-priority-filter"
                            className="form-select"
                            value={requestedPriority}
                            onChange={(event) => {
                                setRequestedPriority(
                                    event.target.value
                                );
                                resetToPageOne();
                            }}
                        >
                            <option value="">
                                All Requested Priorities
                            </option>

                            {PRIORITY_OPTIONS.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-it-priority-filter"
                            className="form-label fw-semibold"
                        >
                            IT Priority
                        </label>

                        <select
                            id="staff-it-priority-filter"
                            className="form-select"
                            value={itPriority}
                            onChange={(event) => {
                                setItPriority(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">
                                All IT Priorities
                            </option>

                            {PRIORITY_OPTIONS.map((option) => (
                                <option
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-owner-filter"
                            className="form-label fw-semibold"
                        >
                            Ownership
                        </label>

                        <select
                            id="staff-owner-filter"
                            className="form-select"
                            value={owner}
                            onChange={(event) => {
                                setOwner(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">All Tickets</option>
                            {currentUser && <option value={currentUser.id}>Owned by you</option>}
                            {owner && !["assigned", "unassigned", currentUser?.id].includes(owner) && <option value={owner}>Owner: {owner}</option>}
                            <option value="assigned">
                                Assigned
                            </option>
                            <option value="unassigned">
                                Unassigned
                            </option>
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-sort"
                            className="form-label fw-semibold"
                        >
                            Sort By
                        </label>

                        <select
                            id="staff-sort"
                            className="form-select"
                            value={sort}
                            onChange={(event) => {
                                setSort(
                                    event.target
                                        .value as StaffTicketSort
                                );
                                resetToPageOne();
                            }}
                        >
                            <option value="updatedAt">
                                Last Updated
                            </option>
                            <option value="createdAt">
                                Created Date
                            </option>
                            <option value="ticketNumber">
                                Ticket Number
                            </option>
                            <option value="status">
                                Status
                            </option>
                            <option value="requestedPriority">
                                Requested Priority
                            </option>
                            <option value="itPriority">
                                IT Priority
                            </option>
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-sort-order"
                            className="form-label fw-semibold"
                        >
                            Direction
                        </label>

                        <select
                            id="staff-sort-order"
                            className="form-select"
                            value={order}
                            onChange={(event) => {
                                setOrder(
                                    event.target
                                        .value as StaffTicketOrder
                                );
                                resetToPageOne();
                            }}
                        >
                            <option value="desc">
                                Descending
                            </option>
                            <option value="asc">
                                Ascending
                            </option>
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3">
                        <label
                            htmlFor="staff-page-size"
                            className="form-label fw-semibold"
                        >
                            Per Page
                        </label>

                        <select
                            id="staff-page-size"
                            className="form-select"
                            value={pageSize}
                            onChange={(event) => {
                                setPageSize(
                                    Number(
                                        event.target.value
                                    ) as 10 | 20 | 50
                                );
                                resetToPageOne();
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-xl-3 d-flex align-items-end">
                        <button
                            type="button"
                            className="btn btn-outline-secondary w-100"
                            onClick={resetQueue}
                            disabled={
                                !hasActiveFilters &&
                                sort === "updatedAt" &&
                                order === "desc" &&
                                pageSize === 20
                            }
                        >
                            Reset Queue
                        </button>
                    </div>
                </div>
            </div>

            {error && (
                <ErrorAlert
                    message={error}
                    onRetry={loadTickets}
                />
            )}

            {loading ? (
                <LoadingSpinner message="Loading ticket queue..." />
            ) : error ? null : tickets.length === 0 ? (
                hasActiveFilters ? (
                    <EmptyState
                        title="No Matching Tickets"
                        description="No tickets match the current search and filter criteria."
                        actionLabel="Clear Filters"
                        onAction={clearFilters}
                    />
                ) : (
                    <EmptyState
                        title="Ticket Queue Is Empty"
                        description="There are currently no tickets in the staff queue."
                    />
                )
            ) : (
                <>
                    <div className="zen-card d-none d-lg-block overflow-hidden">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th scope="col">Ticket #</th>
                                        <th scope="col">Created</th>
                                        <th scope="col">Summary</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">
                                            Requested Priority
                                        </th>
                                        <th scope="col">
                                            IT Priority
                                        </th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Owner</th>
                                        <th scope="col">
                                            Last Updated
                                        </th>
                                        <th scope="col">Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {tickets.map((ticket) => (
                                        <tr key={ticket.id}>
                                            <td className="fw-semibold text-primary-green">
                                                {ticket.ticketNumber}
                                            </td>

                                            <td>
                                                {formatDate(
                                                    ticket.createdAt
                                                )}
                                            </td>

                                            <td>
                                                <div className="fw-semibold">
                                                    {ticket.summary}
                                                </div>

                                                <div className="small text-secondary">
                                                    {
                                                        ticket
                                                            .requester
                                                            .name
                                                    }
                                                </div>
                                            </td>

                                            <td>
                                                {
                                                    ticket.category
                                                        .name
                                                }
                                            </td>

                                            <td>
                                                <StatusBadge
                                                    label={priorityLabel(
                                                        ticket.requestedPriority
                                                    )}
                                                    variant={priorityVariant(
                                                        ticket.requestedPriority
                                                    )}
                                                />
                                            </td>

                                            <td>
                                                <StatusBadge
                                                    label={priorityLabel(
                                                        ticket.itPriority
                                                    )}
                                                    variant={priorityVariant(
                                                        ticket.itPriority
                                                    )}
                                                />
                                            </td>

                                            <td>
                                                <StatusBadge
                                                    label={statusLabel(
                                                        ticket.status
                                                    )}
                                                    variant={statusVariant(
                                                        ticket.status
                                                    )}
                                                />
                                            </td>

                                            <td>
                                                {ticket.owner
                                                    ?.name ??
                                                    "Unassigned"}
                                            </td>

                                            <td>
                                                {formatDateTime(
                                                    ticket.updatedAt
                                                )}
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-primary-green"
                                                    onClick={() =>
                                                        onOpenTicket(
                                                            ticket.id
                                                        )
                                                    }
                                                >
                                                    Open
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="d-lg-none">
                        <div className="d-flex flex-column gap-3">
                            {tickets.map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="zen-card p-3"
                                >
                                    <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                                        <span className="fw-bold text-primary-green">
                                            {
                                                ticket.ticketNumber
                                            }
                                        </span>

                                        <StatusBadge
                                            label={statusLabel(
                                                ticket.status
                                            )}
                                            variant={statusVariant(
                                                ticket.status
                                            )}
                                        />
                                    </div>

                                    <div className="fw-semibold mb-3">
                                        {ticket.summary}
                                    </div>

                                    <dl className="row small mb-3">
                                        <dt className="col-5">
                                            Requester
                                        </dt>
                                        <dd className="col-7">
                                            {
                                                ticket.requester
                                                    .name
                                            }
                                        </dd>

                                        <dt className="col-5">
                                            Category
                                        </dt>
                                        <dd className="col-7">
                                            {
                                                ticket.category
                                                    .name
                                            }
                                        </dd>

                                        <dt className="col-5">
                                            IT Priority
                                        </dt>
                                        <dd className="col-7">
                                            {priorityLabel(
                                                ticket.itPriority
                                            )}
                                        </dd>

                                        <dt className="col-5">
                                            Owner
                                        </dt>
                                        <dd className="col-7">
                                            {ticket.owner
                                                ?.name ??
                                                "Unassigned"}
                                        </dd>

                                        <dt className="col-5">
                                            Updated
                                        </dt>
                                        <dd className="col-7 mb-0">
                                            {formatDateTime(
                                                ticket.updatedAt
                                            )}
                                        </dd>
                                    </dl>

                                    <button
                                        type="button"
                                        className="btn btn-outline-primary-green w-100"
                                        onClick={() =>
                                            onOpenTicket(
                                                ticket.id
                                            )
                                        }
                                    >
                                        Open Ticket
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-4">
                        <div className="small text-secondary">
                            {meta.totalItems} ticket
                            {meta.totalItems === 1 ? "" : "s"}
                            {" · "}
                            Page {meta.page}
                            {meta.totalPages > 0
                                ? ` of ${meta.totalPages}`
                                : ""}
                        </div>

                        <nav aria-label="Staff ticket queue pagination">
                            <div className="btn-group">
                                <button
                                    type="button"
                                    className="btn btn-outline-primary-green"
                                    disabled={page <= 1}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(
                                                1,
                                                current - 1
                                            )
                                        )
                                    }
                                >
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-outline-primary-green"
                                    disabled={
                                        meta.totalPages === 0 ||
                                        page >=
                                            meta.totalPages
                                    }
                                    onClick={() =>
                                        setPage(
                                            (current) =>
                                                current + 1
                                        )
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </nav>
                    </div>
                </>
            )}
        </div>
    );
};

export default StaffTicketQueueScreen;
