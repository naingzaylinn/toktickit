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

import {
    getMyTickets,
    getRelatedSystems,
    getTicketCategories,
} from "../../src/api.js";

import MyTicketsScreen from "../../src/components/MyTicketsScreen.js";

vi.mock("../../src/api.js", async () => {
    const actual =
        await vi.importActual<typeof import("../../src/api.js")>(
            "../../src/api.js"
        );

    return {
        ...actual,
        getMyTickets: vi.fn(),
        getTicketCategories: vi.fn(),
        getRelatedSystems: vi.fn(),
    };
});

const requester = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Alice Developer",
    email: "alice@kmutt.ac.th",
};

const categories = [
    {
        id: 1,
        name: "Account and Access",
    },
    {
        id: 2,
        name: "Hardware",
    },
];

const systems = [
    {
        id: "3f4a5b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
        name: "Campus Wi-Fi",
    },
    {
        id: "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        name: "VPN",
    },
];

const ticket = {
    id: "ticket-1",
    ticketNumber: "TKT-2026-00001",
    ticketDate: "2026-09-05T12:00:00.000Z",
    currentStatus: "New" as const,
    requestedPriority: "High" as const,
    summary: "VPN connection problem",
    category: {
        id: 2,
        name: "Hardware",
    },
    relatedSystem: {
        id: "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        name: "VPN",
    },
    activeAttachmentCount: 0,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
};

function ticketResponse(data = [ticket]) {
    return {
        data,
        pagination: {
            page: 1,
            pageSize: 10,
            totalItems: data.length,
            totalPages: data.length > 0 ? 1 : 0,
            hasNextPage: false,
            hasPreviousPage: false,
        },
    };
}

describe("Feature-E: My Tickets UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(getTicketCategories).mockResolvedValue(
            categories
        );

        vi.mocked(getRelatedSystems).mockResolvedValue(
            systems
        );

        vi.mocked(getMyTickets).mockResolvedValue(
            ticketResponse()
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders tickets and required desktop columns", async () => {
        render(
            <MyTicketsScreen
                currentRequester={requester}
                onCreateTicket={vi.fn()}
                onOpenTicket={vi.fn()}
            />
        );

        expect(
            (await screen.findAllByText("TKT-2026-00001")).length
        ).toBeGreaterThan(0);

        const headers = [
            "Ticket #",
            "Summary",
            "Category",
            "System",
            "Priority",
            "Status",
            "Attachments",
            "Date",
        ];

        for (const name of headers) {
            expect(
                screen.getByRole("columnheader", {
                    name,
                })
            ).toBeInTheDocument();
        }
    });

    it("UI-024: renders true empty state with Create Ticket CTA", async () => {
        vi.mocked(getMyTickets).mockResolvedValue(
            ticketResponse([])
        );

        const onCreateTicket = vi.fn();

        render(
            <MyTicketsScreen
                currentRequester={requester}
                onCreateTicket={onCreateTicket}
                onOpenTicket={vi.fn()}
            />
        );

        expect(
            await screen.findByText("No Tickets Found")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "You have not submitted any IT support tickets yet."
            )
        ).toBeInTheDocument();

        const createTicketButtons = screen.getAllByRole("button", {
            name: "+ Create Ticket",
        });

        fireEvent.click(createTicketButtons[1]);

        expect(onCreateTicket).toHaveBeenCalledTimes(1);
    });

    it("UI-025 and UI-026: shows no-results state and clears filters", async () => {
        vi.mocked(getMyTickets)
            .mockResolvedValueOnce(ticketResponse())
            .mockResolvedValueOnce(ticketResponse([]))
            .mockResolvedValue(ticketResponse());

        render(
            <MyTicketsScreen
                currentRequester={requester}
                onCreateTicket={vi.fn()}
                onOpenTicket={vi.fn()}
            />
        );

        await screen.findAllByText("TKT-2026-00001");

        fireEvent.change(
            screen.getByLabelText("Priority"),
            {
                target: {
                    value: "Urgent",
                },
            }
        );

        expect(
            await screen.findByText("No Matching Tickets")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "No tickets match your search and filter criteria."
            )
        ).toBeInTheDocument();

        const clearFilterButtons = screen.getAllByRole("button", {
            name: "Clear Filters",
        });

        fireEvent.click(clearFilterButtons[1]);

        expect(
            screen.getByLabelText("Priority")
        ).toHaveValue("");

        expect(
            (await screen.findAllByText("TKT-2026-00001")).length
        ).toBeGreaterThan(0);
    });

    it("UI-027: clicking a ticket opens ticket detail", async () => {
        const onOpenTicket = vi.fn();

        render(
            <MyTicketsScreen
                currentRequester={requester}
                onCreateTicket={vi.fn()}
                onOpenTicket={onOpenTicket}
            />
        );

        const ticketNumbers =
            await screen.findAllByText(
                "TKT-2026-00001"
            );

        const ticketNumber = ticketNumbers.find(
            (element) => element.closest("tr")
        );

        expect(ticketNumber).toBeDefined();

        const row = ticketNumber.closest("tr");

        expect(row).not.toBeNull();

        fireEvent.click(row!);

        expect(onOpenTicket).toHaveBeenCalledWith(
            "ticket-1"
        );
    });

    it("UI-023: changing a filter resets page to 1", async () => {
        render(
            <MyTicketsScreen
                currentRequester={requester}
                onCreateTicket={vi.fn()}
                onOpenTicket={vi.fn()}
            />
        );

        await screen.findAllByText("TKT-2026-00001");

        fireEvent.change(
            screen.getByLabelText("Category"),
            {
                target: {
                    value: "2",
                },
            }
        );

        await waitFor(() => {
            expect(getMyTickets).toHaveBeenCalledWith(
                requester.id,
                expect.objectContaining({
                    categoryId: 2,
                    page: 1,
                })
            );
        });
    });

    it("UI-022: debounces search by about 300 ms", async () => {
        vi.useFakeTimers();

        render(
            <MyTicketsScreen
                currentRequester={requester}
                onCreateTicket={vi.fn()}
                onOpenTicket={vi.fn()}
            />
        );

        await act(async () => {
            await Promise.resolve();
        });

        const initialCallCount =
            vi.mocked(getMyTickets).mock.calls.length;

        fireEvent.change(
            screen.getByLabelText("Search"),
            {
                target: {
                    value: "vpn",
                },
            }
        );

        await act(async () => {
            vi.advanceTimersByTime(200);
        });

        expect(
            vi.mocked(getMyTickets).mock.calls.length
        ).toBe(initialCallCount);

        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
        });

        expect(getMyTickets).toHaveBeenCalledWith(
            requester.id,
            expect.objectContaining({
                q: "vpn",
                page: 1,
            })
        );
    });
});