import {
    uploadTicketAttachments,
} from "../../src/api.js";
import React from "react";
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateTicketScreen from "../../src/components/CreateTicketScreen.js";

vi.mock("../../src/api.js", async () => {
    const actual =
        await vi.importActual<
            typeof import("../../src/api.js")
        >("../../src/api.js");

    return {
        ...actual,
        uploadTicketAttachments: vi.fn(),
    };
});

const requester = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Alice Developer",
    email: "alice@kmutt.ac.th",
};

const categoriesResponse = {
    data: [
        { id: 1, name: "Account and Access" },
        { id: 2, name: "Hardware" },
    ],
};

const systemsResponse = {
    data: [
        {
            id: "3f4a5b6c-7d8e-9f0a-1b2c-3d4e5f6a7b8c",
            name: "Campus Wi-Fi",
        },
        {
            id: "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
            name: "VPN",
        },
    ],
};

function jsonResponse(
    body: unknown,
    status = 200
): Promise<Response> {
    return Promise.resolve(
        new Response(JSON.stringify(body), {
            status,
            headers: {
                "Content-Type": "application/json",
            },
        })
    );
}

function mockReferenceData() {
    vi.mocked(fetch)
        .mockImplementationOnce(() =>
            jsonResponse(categoriesResponse)
        )
        .mockImplementationOnce(() =>
            jsonResponse(systemsResponse)
        );
}

describe("Feature-D: Create Ticket UI", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.stubGlobal("fetch", vi.fn());
        vi.mocked(
            uploadTicketAttachments
        ).mockResolvedValue({
            accepted: [],
            rejected: [],
            activeAttachmentCount: 0,
        });
    });

    it("renders requester and system-generated fields", async () => {
        mockReferenceData();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(
            screen.getByText("Alice Developer")
        ).toBeInTheDocument();

        expect(
            screen.getByText("Generated upon submission")
        ).toBeInTheDocument();

        expect(
            screen.getByText("Recorded upon submission")
        ).toBeInTheDocument();

        await screen.findByRole("option", {
            name: "Hardware",
        });
    });

    it("loads active Category and Related System options", async () => {
        mockReferenceData();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        expect(
            await screen.findByRole("option", {
                name: "Account and Access",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("option", {
                name: "Hardware",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("option", {
                name: "Campus Wi-Fi",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("option", {
                name: "VPN",
            })
        ).toBeInTheDocument();
    });

    it("defaults Requested Priority to Medium", async () => {
        mockReferenceData();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        expect(
            screen.getByRole("radio", {
                name: "Medium",
            })
        ).toBeChecked();
    });

    it("shows inline validation for an invalid submission", async () => {
        mockReferenceData();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        fireEvent.click(
            screen.getByRole("button", {
                name: "Submit Ticket",
            })
        );

        expect(
            await screen.findByText("Please select a Category.")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Please select a Related System."
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Summary must be between 5 and 120 characters."
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Description must be between 10 and 2000 characters."
            )
        ).toBeInTheDocument();
    });

    it("updates Summary and Description character counters", async () => {
        mockReferenceData();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        fireEvent.change(
            screen.getByLabelText(/Ticket Summary/i),
            {
                target: {
                    value: "VPN problem",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/^Description/i),
            {
                target: {
                    value: "VPN does not connect.",
                },
            }
        );

        expect(
            screen.getByText("Summary character count: 11 / 120")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Description character count: 21 / 2000"
            )
        ).toBeInTheDocument();
    });

    it("submits a valid ticket and calls onCreated", async () => {
        mockReferenceData();

        const createdTicket = {
            id: "ticket-1",
            ticketNumber: "TKT-2026-00001",
            ticketDate: "2026-09-05T12:00:00.000Z",
            currentStatus: "New",
            requestedPriority: "Medium",
            summary: "VPN connection problem",
            description:
                "The VPN connection does not work from home.",
            requesterId: requester.id,
            categoryId: 2,
            relatedSystemId:
                "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        };

        vi.mocked(fetch).mockImplementationOnce(() =>
            jsonResponse({
                data: createdTicket,
            }, 201)
        );

        const onCreated = vi.fn();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={onCreated}
                onCancel={vi.fn()}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        fireEvent.change(
            screen.getByLabelText(/Category/i),
            {
                target: {
                    value: "2",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/Related System/i),
            {
                target: {
                    value:
                        "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/Ticket Summary/i),
            {
                target: {
                    value: "VPN connection problem",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/^Description/i),
            {
                target: {
                    value:
                        "The VPN connection does not work from home.",
                },
            }
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Submit Ticket",
            })
        );

        await waitFor(() => {
            expect(onCreated).toHaveBeenCalledTimes(1);
        });

        expect(onCreated).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "ticket-1",
                ticketNumber: "TKT-2026-00001",
                currentStatus: "New",
            })
        );
    });

    it("uploads staged attachments after ticket creation", async () => {
        mockReferenceData();

        const createdTicket = {
            id: "ticket-attachments-1",
            ticketNumber: "TKT-2026-00002",
            ticketDate: "2026-09-05T12:00:00.000Z",
            currentStatus: "New",
            requestedPriority: "Medium",
            summary: "VPN attachment problem",
            description:
                "The VPN issue includes a screenshot.",
            requesterId: requester.id,
            categoryId: 2,
            relatedSystemId:
                "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        };

        vi.mocked(fetch).mockImplementationOnce(() =>
            jsonResponse(
                {
                    data: createdTicket,
                },
                201
            )
        );

        const onCreated = vi.fn();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={onCreated}
                onCancel={vi.fn()}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        fireEvent.change(
            screen.getByLabelText(/Category/i),
            {
                target: {
                    value: "2",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/Related System/i),
            {
                target: {
                    value:
                        "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/Ticket Summary/i),
            {
                target: {
                    value:
                        "VPN attachment problem",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/^Description/i),
            {
                target: {
                    value:
                        "The VPN issue includes a screenshot.",
                },
            }
        );

        const file = new File(
            ["image"],
            "vpn.png",
            {
                type: "image/png",
            }
        );

        fireEvent.change(
            screen.getByLabelText("Select files"),
            {
                target: {
                    files: [file],
                },
            }
        );

        expect(
            screen.getByText("1 / 5 selected")
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Submit Ticket",
            })
        );

        await waitFor(() => {
            expect(
                uploadTicketAttachments
            ).toHaveBeenCalledWith(
                requester.id,
                createdTicket.id,
                [file]
            );
        });

        expect(onCreated).toHaveBeenCalledWith(
            expect.objectContaining({
                id: createdTicket.id,
            })
        );
    });

    it("still completes ticket creation when attachment upload fails", async () => {
        mockReferenceData();

        const createdTicket = {
            id: "ticket-attachments-2",
            ticketNumber: "TKT-2026-00003",
            ticketDate: "2026-09-05T12:00:00.000Z",
            currentStatus: "New",
            requestedPriority: "Medium",
            summary: "VPN upload failure",
            description:
                "Ticket creation should still succeed.",
            requesterId: requester.id,
            categoryId: 2,
            relatedSystemId:
                "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
        };

        vi.mocked(fetch).mockImplementationOnce(() =>
            jsonResponse(
                {
                    data: createdTicket,
                },
                201
            )
        );

        vi.mocked(
            uploadTicketAttachments
        ).mockRejectedValue(
            new Error("upload failed")
        );

        const onCreated = vi.fn();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={onCreated}
                onCancel={vi.fn()}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        fireEvent.change(
            screen.getByLabelText(/Category/i),
            {
                target: {
                    value: "2",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/Related System/i),
            {
                target: {
                    value:
                        "9f0a1b2c-3d4e-5f6a-7b8c-9d0e1f2a3b4c",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/Ticket Summary/i),
            {
                target: {
                    value:
                        "VPN upload failure",
                },
            }
        );

        fireEvent.change(
            screen.getByLabelText(/^Description/i),
            {
                target: {
                    value:
                        "Ticket creation should still succeed.",
                },
            }
        );

        const file = new File(
            ["image"],
            "failed.png",
            {
                type: "image/png",
            }
        );

        fireEvent.change(
            screen.getByLabelText("Select files"),
            {
                target: {
                    files: [file],
                },
            }
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Submit Ticket",
            })
        );

        await waitFor(() => {
            expect(
                uploadTicketAttachments
            ).toHaveBeenCalledTimes(1);
        });

        expect(onCreated).toHaveBeenCalledWith(
            expect.objectContaining({
                id: createdTicket.id,
            })
        );
    });

    it("Cancel calls the supplied cancellation handler", async () => {
        mockReferenceData();

        const onCancel = vi.fn();

        render(
            <CreateTicketScreen
                currentRequester={requester}
                onCreated={vi.fn()}
                onCancel={onCancel}
            />
        );

        await screen.findByRole("option", {
            name: "Hardware",
        });

        fireEvent.click(
            screen.getByRole("button", {
                name: "Cancel",
            })
        );

        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});