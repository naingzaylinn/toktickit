import React from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import { getStaffTickets } from "../../src/api.js";
import StaffTicketQueueScreen from "../../src/components/StaffTicketQueueScreen.js";

vi.mock("../../src/api.js", async () => {
    const actual =
        await vi.importActual<typeof import("../../src/api.js")>(
            "../../src/api.js"
        );

    return {
        ...actual,
        getStaffTickets: vi.fn(),
    };
});

const ticket = {
    id: "staff-ticket-1",
    ticketNumber: "TKT-2026-01001",
    summary: "Campus Wi-Fi unavailable",
    category: {
        id: 1,
        name: "Network",
    },
    requester: {
        id: "requester-1",
        name: "Requester One",
        email: "requester1@example.com",
    },
    requestedPriority: "HIGH" as const,
    itPriority: "URGENT" as const,
    status: "OPEN" as const,
    owner: {
        id: "staff-1",
        name: "Staff One",
        email: "staff1@example.com",
    },
    createdAt: "2026-09-19T03:00:00.000Z",
    updatedAt: "2026-09-19T04:00:00.000Z",
};

function queueResponse(data = [ticket]) {
    return {
        data,
        meta: {
            page: 1,
            pageSize: 20,
            totalItems: data.length,
            totalPages: data.length > 0 ? 1 : 0,
        },
    };
}

describe("Lab 3 Staff Ticket Queue UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(getStaffTickets).mockResolvedValue(
            queueResponse()
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders documented queue columns and ticket information", async () => {
        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        expect(
            (await screen.findAllByText("TKT-2026-01001"))
                .length
        ).toBeGreaterThan(0);

        const headers = [
            "Ticket #",
            "Created",
            "Summary",
            "Category",
            "Requested Priority",
            "IT Priority",
            "Status",
            "Owner",
            "Last Updated",
            "Action",
        ];

        for (const name of headers) {
            expect(
                screen.getByRole("columnheader", {
                    name,
                })
            ).toBeInTheDocument();
        }

        expect(
            screen.getAllByText("Open").length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText("Urgent").length
        ).toBeGreaterThan(0);

        expect(
            screen.getAllByText("Staff One").length
        ).toBeGreaterThan(0);
    });

    it("sends documented status, priority, owner, sort and order filters", async () => {
        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        await screen.findAllByText("TKT-2026-01001");

        fireEvent.change(
            screen.getByLabelText("Status"),
            {
                target: {
                    value: "IN_PROGRESS",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText("Requested Priority"),
            {
                target: {
                    value: "HIGH",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText("IT Priority"),
            {
                target: {
                    value: "URGENT",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText("Ownership"),
            {
                target: {
                    value: "unassigned",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText("Sort By"),
            {
                target: {
                    value: "ticketNumber",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText("Direction"),
            {
                target: {
                    value: "asc",
                },
            }
        );

        await waitFor(() => {
            expect(getStaffTickets).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: "IN_PROGRESS",
                    requestedPriority: "HIGH",
                    itPriority: "URGENT",
                    owner: "unassigned",
                    sort: "ticketNumber",
                    order: "asc",
                    page: 1,
                })
            );
        });
    });

    it("debounces queue search by about 300 ms", async () => {
        vi.useFakeTimers();

        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });

        const initialCallCount =
            vi.mocked(getStaffTickets).mock.calls.length;

        fireEvent.change(
            screen.getByLabelText("Search"),
            {
                target: {
                    value: "wifi",
                },
            }
        );

        await act(async () => {
            vi.advanceTimersByTime(200);
        });

        expect(
            vi.mocked(getStaffTickets).mock.calls.length
        ).toBe(initialCallCount);

        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
        });

        expect(getStaffTickets).toHaveBeenCalledWith(
            expect.objectContaining({
                search: "wifi",
                page: 1,
            })
        );
    });

    it("shows a true empty queue state", async () => {
        vi.mocked(getStaffTickets).mockResolvedValue(
            queueResponse([])
        );

        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        expect(
            await screen.findByText("Ticket Queue Is Empty")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "There are currently no tickets in the staff queue."
            )
        ).toBeInTheDocument();
    });

    it("shows a distinct no-results state and can clear filters", async () => {
        vi.mocked(getStaffTickets)
            .mockResolvedValueOnce(queueResponse())
            .mockResolvedValueOnce(queueResponse([]))
            .mockResolvedValue(queueResponse());

        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        await screen.findAllByText("TKT-2026-01001");

        fireEvent.change(
            screen.getByLabelText("Status"),
            {
                target: {
                    value: "CLOSED",
                },
            }
        );

        expect(
            await screen.findByText("No Matching Tickets")
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Clear Filters",
            })
        );

        expect(
            screen.getByLabelText("Status")
        ).toHaveValue("");

        expect(
            (await screen.findAllByText("TKT-2026-01001"))
                .length
        ).toBeGreaterThan(0);
    });

    it("shows a safe failure state and supports retry", async () => {
        vi.mocked(getStaffTickets)
            .mockRejectedValueOnce(
                new Error("database secret should not appear")
            )
            .mockResolvedValue(queueResponse());

        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        expect(
            await screen.findByText(
                "Unable to load the staff ticket queue right now. Please try again."
            )
        ).toBeInTheDocument();

        expect(
            screen.queryByText(
                "database secret should not appear"
            )
        ).not.toBeInTheDocument();

        fireEvent.click(
    screen.getByRole("button", {
        name: /retry/i,
    })
);

        expect(
            (await screen.findAllByText("TKT-2026-01001"))
                .length
        ).toBeGreaterThan(0);
    });

    it("opens the selected ticket", async () => {
        const onOpenTicket = vi.fn();

        render(
            <StaffTicketQueueScreen
                onOpenTicket={onOpenTicket}
            />
        );

        await screen.findAllByText("TKT-2026-01001");

        const openButtons = screen.getAllByRole("button", {
            name: /open/i,
        });

        fireEvent.click(openButtons[0]);

        expect(onOpenTicket).toHaveBeenCalledWith(
            "staff-ticket-1"
        );
    });

    it("supports documented pagination and page sizes", async () => {
        vi.mocked(getStaffTickets).mockResolvedValue({
            data: [ticket],
            meta: {
                page: 1,
                pageSize: 20,
                totalItems: 21,
                totalPages: 2,
            },
        });

        render(
            <StaffTicketQueueScreen
                onOpenTicket={vi.fn()}
            />
        );

        await screen.findAllByText("TKT-2026-01001");

        expect(
            screen.getByText(/21 tickets/)
        ).toBeInTheDocument();

        expect(
            screen.getByText(/Page 1 of 2/)
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Next",
            })
        );

        await waitFor(() => {
            expect(getStaffTickets).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 2,
                    pageSize: 20,
                })
            );
        });

        fireEvent.change(
            screen.getByLabelText("Per Page"),
            {
                target: {
                    value: "50",
                },
            }
        );

        await waitFor(() => {
            expect(getStaffTickets).toHaveBeenCalledWith(
                expect.objectContaining({
                    page: 1,
                    pageSize: 50,
                })
            );
        });
    });
});