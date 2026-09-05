import React from "react";
import {
    fireEvent,
    render,
    screen,
} from "@testing-library/react";
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    ApiError,
    getTicketDetail,
} from "../../src/api.js";

import TicketDetailScreen from "../../src/components/TicketDetailScreen.js";

vi.mock("../../src/api.js", async () => {
    const actual =
        await vi.importActual<typeof import("../../src/api.js")>(
            "../../src/api.js"
        );

    return {
        ...actual,
        getTicketDetail: vi.fn(),
    };
});

const requester = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Alice Developer",
    email: "alice@kmutt.ac.th",
};

const ticket = {
    id: "11111111-1111-4111-8111-111111111111",
    ticketNumber: "TKT-2026-00001",
    ticketDate: "2026-09-05T13:00:00.000Z",
    currentStatus: "New" as const,
    requestedPriority: "Medium" as const,
    summary: "Cannot connect to campus VPN",
    description:
        "The VPN connection fails after authentication from home.",
    requester: {
        id: requester.id,
        name: "Alice Developer",
        email: "alice@kmutt.ac.th",
    },
    category: {
        id: 2,
        name: "Hardware",
        isActive: true,
    },
    relatedSystem: {
        id: "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        name: "VPN",
        isActive: true,
    },
    activeAttachments: [],
    removedAttachments: [],
    createdAt: "2026-09-05T13:00:00.000Z",
    updatedAt: "2026-09-05T13:05:00.000Z",
};

describe("Feature-F: Ticket Detail UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(getTicketDetail).mockResolvedValue(ticket);
    });

    it("UI-028: renders all ticket fields as read-only content", async () => {
        const { container } = render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={ticket.id}
                onBack={vi.fn()}
            />
        );

        expect(
            await screen.findByRole("heading", {
                name: "Ticket TKT-2026-00001",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByText("Alice Developer")
        ).toBeInTheDocument();

        expect(
            screen.getByText("alice@kmutt.ac.th")
        ).toBeInTheDocument();

        expect(
            screen.getByText("Hardware")
        ).toBeInTheDocument();

        expect(
            screen.getByText("VPN")
        ).toBeInTheDocument();

        expect(
            screen.getByText("Cannot connect to campus VPN")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "The VPN connection fails after authentication from home."
            )
        ).toBeInTheDocument();

        expect(
            container.querySelector(
                'input:not([type="file"])'
            )
        ).toBeNull();

        expect(
            container.querySelector("textarea")
        ).toBeNull();

        expect(
            container.querySelector("select")
        ).toBeNull();
    });

    it("UI-029: renders Ticket Date in the user's local locale", async () => {
        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={ticket.id}
                onBack={vi.fn()}
            />
        );

        const expectedDate = new Date(
            ticket.ticketDate
        ).toLocaleString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        });

        expect(
            await screen.findByText(
                `Submitted on ${expectedDate}`
            )
        ).toBeInTheDocument();
    });

    it("UI-030: displays inactive indicators for historical references", async () => {
        vi.mocked(getTicketDetail).mockResolvedValue({
            ...ticket,
            category: {
                ...ticket.category,
                isActive: false,
            },
            relatedSystem: {
                ...ticket.relatedSystem,
                isActive: false,
            },
        });

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={ticket.id}
                onBack={vi.fn()}
            />
        );

        expect(
            await screen.findByText("Hardware")
        ).toBeInTheDocument();

        expect(
            screen.getByText("VPN")
        ).toBeInTheDocument();

        expect(
            screen.getAllByText("Inactive")
        ).toHaveLength(2);
    });

    it("UI-031: renders neutral Ticket Not Found screen on 404", async () => {
        vi.mocked(getTicketDetail).mockRejectedValue(
            new ApiError(
                "TICKET_NOT_FOUND",
                "The requested ticket was not found.",
                404
            )
        );

        const onBack = vi.fn();

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={ticket.id}
                onBack={onBack}
            />
        );

        expect(
            await screen.findByRole("heading", {
                name: "Ticket Not Found",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "The requested ticket does not exist or you do not have permission to view it."
            )
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "← Return to My Tickets",
            })
        );

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("UI-032: excludes out-of-scope staff and workflow controls", async () => {
        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={ticket.id}
                onBack={vi.fn()}
            />
        );

        await screen.findByRole("heading", {
            name: "Ticket TKT-2026-00001",
        });

        expect(
            screen.queryByText(/Public Comments/i)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(/Internal Notes/i)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(/Actions Taken/i)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByText(/Assigned To/i)
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole("combobox")
        ).not.toBeInTheDocument();
    });

    it("Back to My Tickets calls onBack", async () => {
        const onBack = vi.fn();

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={ticket.id}
                onBack={onBack}
            />
        );

        await screen.findByRole("heading", {
            name: "Ticket TKT-2026-00001",
        });

        fireEvent.click(
            screen.getByRole("button", {
                name: "← Back to My Tickets",
            })
        );

        expect(onBack).toHaveBeenCalledTimes(1);
    });
});