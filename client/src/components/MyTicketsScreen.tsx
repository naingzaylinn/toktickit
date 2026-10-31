import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    RequesterIdentity,
    ApiError, requesterStatusFromDashboard, RequesterTicketStatus,
    getMyTickets,
    getRelatedSystems,
    getTicketCategories,
    MyTicketsQuery,
    RelatedSystem,
    RequestedPriority,
    TicketListItem,
    TicketPagination,
    TicketReferenceCategory,
    TicketSort,
} from "../api.js";
import EmptyState from "./common/EmptyState.js";
import ErrorAlert from "./common/ErrorAlert.js";
import LoadingSpinner from "./common/LoadingSpinner.js";
import StatusBadge from "./common/StatusBadge.js";

interface MyTicketsScreenProps {
    currentRequester: RequesterIdentity & { role?: string };
    onCreateTicket: () => void;
    onOpenTicket: (ticketId: string) => void;
}

const DEFAULT_PAGINATION: TicketPagination = {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
};

export const MyTicketsScreen: React.FC<MyTicketsScreenProps> = props => <MyTicketsContent key={props.currentRequester.id + ":" + (props.currentRequester.role ?? "REQUESTER")} {...props}/>;
const MyTicketsContent: React.FC<MyTicketsScreenProps> = ({
    currentRequester,
    onCreateTicket,
    onOpenTicket,
}) => {
    const [tickets, setTickets] = useState<TicketListItem[]>([]);
    const [categories, setCategories] = useState<TicketReferenceCategory[]>([]);
    const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);

    const initial = useRef(new URLSearchParams(window.location.search)).current;
    const [searchInput, setSearchInput] = useState(initial.get("q") ?? "");
    const [debouncedSearch, setDebouncedSearch] = useState(initial.get("q") ?? "");

    const [categoryId, setCategoryId] = useState(initial.get("categoryId") ?? "");
    const [relatedSystemId, setRelatedSystemId] = useState(initial.get("relatedSystemId") ?? "");
    const [requestedPriority, setRequestedPriority] = useState(initial.get("requestedPriority") ?? "");
    const [currentStatus, setCurrentStatus] = useState(initial.get("currentStatus") ?? "");
    const [sortBy, setSortBy] = useState<TicketSort>((initial.get("sortBy") as TicketSort) || "newest");
    const [page, setPage] = useState(Number(initial.get("page") ?? 1));
    const [pageSize, setPageSize] = useState<10 | 20 | 50>(Number(initial.get("pageSize") ?? 10) as 10 | 20 | 50);

    const [pagination, setPagination] =
        useState<TicketPagination>(DEFAULT_PAGINATION);

    const [loading, setLoading] = useState(true);
    const [referenceLoading, setReferenceLoading] = useState(true);
    const [referenceError, setReferenceError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [statusGroup, setStatusGroup] = useState(initial.get("statusGroup") ?? "");
    const generation = useRef(0);
    const pending = useRef<AbortController | null>(null);
    const referencePending = useRef<AbortController | null>(null);
    const skipUrlSync = useRef(true);
    const ownNavigation = useRef(false);
    const [routeRevision, setRouteRevision] = useState(0);
    const [denied, setDenied] = useState(false);

    const hasActiveQuery =
        debouncedSearch.length > 0 ||
        categoryId !== "" ||
        relatedSystemId !== "" ||
        requestedPriority !== "" ||
        currentStatus !== "" || statusGroup !== "";

    const hasQuerySettings = hasActiveQuery || sortBy !== "newest" || pageSize !== 10 || page !== 1;

    const query = useMemo<MyTicketsQuery>(() => {
        return {
            q: debouncedSearch || undefined,
            categoryId: categoryId ? Number(categoryId) : undefined,
            relatedSystemId: relatedSystemId || undefined,
            requestedPriority:
                (requestedPriority as RequestedPriority) || undefined,
            currentStatus:
                (currentStatus as RequesterTicketStatus) || undefined,
            statusGroup: (statusGroup as "active") || undefined,
            sortBy,
            page,
            pageSize,
        };
    }, [
        debouncedSearch,
        categoryId,
        relatedSystemId,
        requestedPriority,
        currentStatus,
        statusGroup, routeRevision,
        sortBy,
        page,
        pageSize,
    ]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            if (searchInput.trim() !== debouncedSearch) setPage(1);
            setDebouncedSearch(searchInput.trim());
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchInput, debouncedSearch]);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        referencePending.current = controller;
        const context = { signal: controller.signal, isCurrent: () => active };
        Promise.all([getTicketCategories(context), getRelatedSystems(context)]).then(([categoryData, systemData]) => {
            if (active) { setCategories(categoryData); setRelatedSystems(systemData); }
        }).catch(() => { if (active) setReferenceError("Unable to load ticket filters. Please try again."); })
          .finally(() => { if (active) setReferenceLoading(false); });
        return () => { active = false; controller.abort(); };
    }, []);

    const loadTickets = async () => {
        pending.current?.abort();
        const controller = new AbortController();
        pending.current = controller;
        const token = ++generation.current;
        setLoading(true); setError(null);
        try {
            const response = await getMyTickets(query, { signal: controller.signal, isCurrent: () => token === generation.current });
            if (token !== generation.current) return;
            setTickets(response.data); setPagination(response.pagination);
        } catch (cause) {
            if (token !== generation.current) return;
            setTickets([]);
            if (cause instanceof ApiError && ([401, 403].includes(cause.status) || cause.code === "PASSWORD_CHANGE_REQUIRED")) {
                ++generation.current; setDenied(true); setLoading(false); return;
            }
            setError("Unable to load your tickets right now. Please try again.");
        } finally { if (token === generation.current) setLoading(false); }
    };
    useEffect(() => {
        void loadTickets();
        return () => { pending.current?.abort(); ++generation.current; };
    }, [query]);
    useEffect(() => {
        if (skipUrlSync.current) { skipUrlSync.current = false; return; }
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || key === "page" && value === 1 || key === "pageSize" && value === 10 || key === "sortBy" && value === "newest") continue;
            params.set(key, String(value));
        }
        const search = params.size ? "?" + params.toString() : "";
        if (window.location.search !== search) {
            ownNavigation.current = true;
            window.history.pushState({}, "", "/tickets" + search);
            window.dispatchEvent(new PopStateEvent("popstate"));
            ownNavigation.current = false;
        }
    }, [query]);
    useEffect(() => {
        const restore = () => {
            if (ownNavigation.current || !["/tickets", "/", "/login"].includes(window.location.pathname)) return;
            const params = new URLSearchParams(window.location.search);
            skipUrlSync.current = true; ++generation.current; setRouteRevision(value => value + 1);
            setSearchInput(params.get("q") ?? ""); setDebouncedSearch(params.get("q") ?? "");
            setCategoryId(params.get("categoryId") ?? ""); setRelatedSystemId(params.get("relatedSystemId") ?? "");
            setRequestedPriority(params.get("requestedPriority") ?? ""); setCurrentStatus(params.get("currentStatus") ?? "");
            setStatusGroup(params.get("statusGroup") ?? ""); setSortBy((params.get("sortBy") as TicketSort) || "newest");
            setPage(Number(params.get("page") ?? 1)); setPageSize(Number(params.get("pageSize") ?? 10) as 10 | 20 | 50);
        };
        const clear = () => { pending.current?.abort(); referencePending.current?.abort(); ++generation.current; setTickets([]); setCategories([]); setRelatedSystems([]); setDenied(true); setLoading(false); };
        window.addEventListener("popstate", restore); window.addEventListener("session-access-changed", clear);
        return () => { pending.current?.abort(); ++generation.current; window.removeEventListener("popstate", restore); window.removeEventListener("session-access-changed", clear); };
    }, []);

    const resetToPageOne = () => {
        setPage(1);
    };

    const clearFilters = () => {
        setSearchInput("");
        setDebouncedSearch("");
        setCategoryId("");
        setRelatedSystemId("");
        setRequestedPriority("");
        setCurrentStatus("");
        setStatusGroup("");
        setSortBy("newest");
        setPage(1);
        setPageSize(10);
    };

    const formatDate = (value: string) => {
        return new Date(value).toLocaleDateString();
    };

    const renderPriorityBadge = (
        priority: RequestedPriority
    ) => {
        let variant:
            | "success"
            | "warning"
            | "danger"
            | "info"
            | "neutral" = "neutral";

        if (priority === "Low") {
            variant = "success";
        } else if (priority === "Medium") {
            variant = "info";
        } else if (priority === "High") {
            variant = "warning";
        } else if (priority === "Urgent") {
            variant = "danger";
        }

        return (
            <StatusBadge
                label={priority}
                variant={variant}
            />
        );
    };

    if (denied) return <p role="alert">My Tickets is unavailable for your session or role.</p>;
    return (
        <div className="my-tickets-screen">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h1 className="h3 fw-bold text-primary-green mb-1">
                        My Tickets
                    </h1>
                    <p className="text-secondary mb-0">
                        View and manage your submitted IT support tickets.
                    </p>
                </div>

                <button
                    type="button"
                    className="btn btn-primary-green"
                    onClick={onCreateTicket}
                >
                    + Create Ticket
                </button>
            </div>

            <div className="zen-card p-3 p-md-4 mb-4">
                <div className="row g-3">
                    <div className="col-12 col-md-6 col-lg-3">
                        <label htmlFor="ticket-status-group" className="form-label fw-semibold">Status group</label>
                        <select id="ticket-status-group" className="form-select" value={statusGroup} onChange={event => { setStatusGroup(event.target.value); resetToPageOne(); }}>
                            <option value="">All Tickets</option><option value="active">Active Tickets</option>
                        </select>
                    </div>
                    <div className="col-12">
                        <label
                            htmlFor="ticket-search"
                            className="form-label fw-semibold"
                        >
                            Search
                        </label>

                        <input
                            id="ticket-search"
                            type="search"
                            className="form-control"
                            placeholder="Search Ticket Number, Summary, or Description"
                            value={searchInput}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                        />
                    </div>

                    <div className="col-12 col-md-6 col-lg-3">
                        <label
                            htmlFor="filter-category"
                            className="form-label fw-semibold"
                        >
                            Category
                        </label>

                        <select
                            id="filter-category"
                            className="form-select"
                            value={categoryId}
                            disabled={referenceLoading}
                            onChange={(event) => {
                                setCategoryId(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">All Categories</option>
                            {categoryId && !categories.some(category => String(category.id) === categoryId) && <option value={categoryId}>Previously selected category (ID: {categoryId})</option>}

                            {categories.map((category) => (
                                <option
                                    key={category.id}
                                    value={category.id}
                                >
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-lg-3">
                        <label
                            htmlFor="filter-system"
                            className="form-label fw-semibold"
                        >
                            Related System
                        </label>

                        <select
                            id="filter-system"
                            className="form-select"
                            value={relatedSystemId}
                            disabled={referenceLoading}
                            onChange={(event) => {
                                setRelatedSystemId(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">All Systems</option>
                            {relatedSystemId && !relatedSystems.some(system => system.id === relatedSystemId) && <option value={relatedSystemId}>Previously selected system (ID: {relatedSystemId})</option>}

                            {relatedSystems.map((system) => (
                                <option
                                    key={system.id}
                                    value={system.id}
                                >
                                    {system.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-lg-3">
                        <label
                            htmlFor="filter-priority"
                            className="form-label fw-semibold"
                        >
                            Priority
                        </label>

                        <select
                            id="filter-priority"
                            className="form-select"
                            value={requestedPriority}
                            onChange={(event) => {
                                setRequestedPriority(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">All Priorities</option>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>

                    <div className="col-12 col-md-6 col-lg-3">
                        <label
                            htmlFor="filter-status"
                            className="form-label fw-semibold"
                        >
                            Status
                        </label>

                        <select
                            id="filter-status"
                            className="form-select"
                            value={currentStatus}
                            onChange={(event) => {
                                setCurrentStatus(event.target.value);
                                resetToPageOne();
                            }}
                        >
                            <option value="">All Statuses</option>
                            {Object.values(requesterStatusFromDashboard).map(status => <option key={status} value={status}>{status.replace(/([a-z])([A-Z])/g, "$1 $2")}</option>)}
                        </select>
                    </div>

                    <div className="col-12 col-md-6">
                        <label
                            htmlFor="ticket-sort"
                            className="form-label fw-semibold"
                        >
                            Sort By
                        </label>

                        <select
                            id="ticket-sort"
                            className="form-select"
                            value={sortBy}
                            onChange={(event) => {
                                setSortBy(event.target.value as TicketSort);
                                resetToPageOne();
                            }}
                        >
                            <option value="newest">
                                Newest First
                            </option>
                            <option value="oldest">
                                Oldest First
                            </option>
                            <option value="recentlyUpdated">
                                Recently Updated
                            </option>
                            <option value="ticketNumberAsc">
                                Ticket Number
                            </option>
                        </select>
                    </div>

                    <div className="col-12 col-md-3">
                        <label
                            htmlFor="ticket-page-size"
                            className="form-label fw-semibold"
                        >
                            Per Page
                        </label>

                        <select
                            id="ticket-page-size"
                            className="form-select"
                            value={pageSize}
                            onChange={(event) => {
                                setPageSize(
                                    Number(event.target.value) as
                                    | 10
                                    | 20
                                    | 50
                                );
                                resetToPageOne();
                            }}
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>

                    <div className="col-12 col-md-3 d-flex align-items-end">
                        <button
                            type="button"
                            className="btn btn-outline-secondary w-100"
                            onClick={clearFilters}
                            disabled={!hasQuerySettings}
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {referenceError && <ErrorAlert message={referenceError}/>}
            {error && (
                <ErrorAlert
                    message={error}
                    onRetry={loadTickets}
                />
            )}

            {loading ? (
                <LoadingSpinner message="Loading your tickets..." />
            ) : error ? null : tickets.length === 0 ? (
                pagination.totalItems > 0 ? (
                    <EmptyState title="No Tickets on This Page" description="The requested page has no results. Return to the first page to view matching Tickets." actionLabel="Go to First Page" onAction={resetToPageOne}/>
                ) : hasActiveQuery ? (
                    <EmptyState
                        title="No Matching Tickets"
                        description="No tickets match your search and filter criteria."
                        actionLabel="Clear Filters"
                        onAction={clearFilters}
                    />
                ) : (
                    <EmptyState
                        title="No Tickets Found"
                        description="You have not submitted any IT support tickets yet."
                        actionLabel="+ Create Ticket"
                        onAction={onCreateTicket}
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
                                        <th scope="col">Summary</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">System</th>
                                        <th scope="col">Priority</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Attachments</th>
                                        <th scope="col">Date</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {tickets.map((ticket) => (
                                        <tr
                                            key={ticket.id}
                                            style={{ cursor: "pointer" }}
                                            onClick={event => {
                                                if (!(event.target as HTMLElement).closest("a, button, input, select, textarea")) onOpenTicket(ticket.id);
                                            }}
                                        >
                                            <td className="fw-semibold text-primary-green">
                                                <a href={"/tickets/" + encodeURIComponent(ticket.id)} onClick={event => {
                                                    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                                                    event.preventDefault(); onOpenTicket(ticket.id);
                                                }}>{ticket.ticketNumber}</a>
                                            </td>

                                            <td>{ticket.summary}</td>

                                            <td>{ticket.category.name}</td>

                                            <td>
                                                {ticket.relatedSystem.name}
                                            </td>

                                            <td>
                                                {renderPriorityBadge(
                                                    ticket.requestedPriority
                                                )}
                                            </td>

                                            <td>
                                                <StatusBadge
                                                    label={ticket.currentStatus}
                                                    variant="info"
                                                />
                                            </td>

                                            <td>
                                                {ticket.activeAttachmentCount}
                                            </td>

                                            <td>
                                                {formatDate(ticket.ticketDate)}
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
                                <button
                                    key={ticket.id}
                                    type="button"
                                    className="zen-card p-3 text-start border-0 w-100"
                                    onClick={() =>
                                        onOpenTicket(ticket.id)
                                    }
                                >
                                    <div className="d-flex justify-content-between gap-3 mb-2">
                                        <span className="fw-bold text-primary-green">
                                            {ticket.ticketNumber}
                                        </span>

                                        <StatusBadge
                                            label={ticket.currentStatus}
                                            variant="info"
                                        />
                                    </div>

                                    <div className="fw-semibold mb-3">
                                        {ticket.summary}
                                    </div>

                                    <dl className="row small mb-0">
                                        <dt className="col-5">
                                            Category
                                        </dt>
                                        <dd className="col-7">
                                            {ticket.category.name}
                                        </dd>

                                        <dt className="col-5">
                                            System
                                        </dt>
                                        <dd className="col-7">
                                            {ticket.relatedSystem.name}
                                        </dd>

                                        <dt className="col-5">
                                            Priority
                                        </dt>
                                        <dd className="col-7">
                                            {ticket.requestedPriority}
                                        </dd>

                                        <dt className="col-5">
                                            Attachments
                                        </dt>
                                        <dd className="col-7">
                                            {ticket.activeAttachmentCount}
                                        </dd>

                                        <dt className="col-5">
                                            Date
                                        </dt>
                                        <dd className="col-7 mb-0">
                                            {formatDate(ticket.ticketDate)}
                                        </dd>
                                    </dl>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mt-4">
                        <div className="small text-secondary">
                            {pagination.totalItems} ticket
                            {pagination.totalItems === 1 ? "" : "s"}
                            {" · "}
                            Page {pagination.page}
                            {pagination.totalPages > 0
                                ? ` of ${pagination.totalPages}`
                                : ""}
                        </div>

                        <nav aria-label="My Tickets pagination">
                            <div className="btn-group">
                                <button
                                    type="button"
                                    className="btn btn-outline-primary-green"
                                    disabled={!pagination.hasPreviousPage}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(1, current - 1)
                                        )
                                    }
                                >
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-outline-primary-green"
                                    disabled={!pagination.hasNextPage}
                                    onClick={() =>
                                        setPage((current) => current + 1)
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

export default MyTicketsScreen;
