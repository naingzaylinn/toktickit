import React from "react";
import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    getAttachmentContent,
    getTicketDetail,
    removeTicketAttachment,
    TicketAttachment,
    TicketDetail,
    uploadTicketAttachments,
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
        uploadTicketAttachments: vi.fn(),
        getAttachmentContent: vi.fn(),
        removeTicketAttachment: vi.fn(),
    };
});

const requester = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Alice Developer",
    email: "alice@kmutt.ac.th",
};

const imageAttachment: TicketAttachment = {
    id: "11111111-1111-4111-8111-111111111111",
    ticketId: "22222222-2222-4222-8222-222222222222",
    originalFilename: "screenshot.png",
    mimeType: "image/png",
    sizeBytes: 1200,
    createdAt: "2026-09-05T13:00:00.000Z",
    isRemoved: false,
    removedAt: null,
    removalReason: null,
    removedByRequesterId: null,
};

const pdfAttachment: TicketAttachment = {
    id: "33333333-3333-4333-8333-333333333333",
    ticketId: "22222222-2222-4222-8222-222222222222",
    originalFilename: "evidence.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    createdAt: "2026-09-05T13:05:00.000Z",
    isRemoved: false,
    removedAt: null,
    removalReason: null,
    removedByRequesterId: null,
};

const removedAttachment: TicketAttachment = {
    ...imageAttachment,
    isRemoved: true,
    removedAt: "2026-09-05T14:00:00.000Z",
    removalReason: "Uploaded the wrong screenshot",
    removedByRequesterId: requester.id,
};

const baseTicket: TicketDetail = {
    id: "22222222-2222-4222-8222-222222222222",
    ticketNumber: "TKT-2026-00001",
    ticketDate: "2026-09-05T12:00:00.000Z",
    currentStatus: "New",
    requestedPriority: "Medium",
    summary: "Cannot connect to VPN",
    description:
        "The VPN connection fails after authentication.",
    requester,
    category: {
        id: 1,
        name: "Hardware",
        isActive: true,
    },
    relatedSystem: {
        id: "44444444-4444-4444-8444-444444444444",
        name: "VPN",
        isActive: true,
    },
    activeAttachments: [],
    removedAttachments: [],
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
};

describe("Feature-G: Attachment Management UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        vi.mocked(getTicketDetail).mockResolvedValue(
            baseTicket
        );

        vi.mocked(getAttachmentContent).mockResolvedValue(
            new Blob(["test"], {
                type: "image/png",
            })
        );

        Object.defineProperty(
            URL,
            "createObjectURL",
            {
                writable: true,
                value: vi.fn(
                    () => "blob:test-preview"
                ),
            }
        );

        Object.defineProperty(
            URL,
            "revokeObjectURL",
            {
                writable: true,
                value: vi.fn(),
            }
        );
    });

    it("UI-033: renders attachment upload control and active capacity count", async () => {
        vi.mocked(getTicketDetail).mockResolvedValue({
            ...baseTicket,
            activeAttachments: [
                imageAttachment,
                pdfAttachment,
            ],
        });

        const { container } = render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={baseTicket.id}
                onBack={vi.fn()}
            />
        );

        expect(
            await screen.findByRole("heading", {
                name: "Attachments",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByText("2 / 5 active")
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                /JPG, PNG, WEBP, or PDF/i
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText("+ Upload Attachment")
        ).toBeInTheDocument();

        const fileInput =
            container.querySelector(
                'input[type="file"]'
            );

        expect(fileInput).not.toBeNull();
        expect(fileInput).toHaveAttribute(
            "multiple"
        );
        expect(fileInput).toHaveAttribute(
            "accept",
            expect.stringContaining(".png")
        );

        expect(
            screen.getByText("screenshot.png")
        ).toBeInTheDocument();

        expect(
            screen.getByText("evidence.pdf")
        ).toBeInTheDocument();
    });

    it("UI-034: shows accepted and rejected feedback for mixed file selection", async () => {
        const updatedTicket: TicketDetail = {
            ...baseTicket,
            activeAttachments: [
                imageAttachment,
            ],
        };

        vi.mocked(getTicketDetail)
            .mockResolvedValueOnce(baseTicket)
            .mockResolvedValueOnce(updatedTicket);

        vi.mocked(
            uploadTicketAttachments
        ).mockResolvedValue({
            accepted: [imageAttachment],
            rejected: [
                {
                    filename: "installer.exe",
                    reason:
                        "Unsupported file format. Allowed formats: JPG, PNG, WEBP, PDF.",
                },
            ],
            activeAttachmentCount: 1,
        });

        const { container } = render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={baseTicket.id}
                onBack={vi.fn()}
            />
        );

        await screen.findByRole("heading", {
            name: "Attachments",
        });

        const fileInput =
            container.querySelector(
                'input[type="file"]'
            ) as HTMLInputElement;

        const validFile = new File(
            ["png"],
            "screenshot.png",
            {
                type: "image/png",
            }
        );

        const invalidFile = new File(
            ["exe"],
            "installer.exe",
            {
                type: "application/octet-stream",
            }
        );

        fireEvent.change(fileInput, {
            target: {
                files: [
                    validFile,
                    invalidFile,
                ],
            },
        });

        await waitFor(() => {
            expect(
                uploadTicketAttachments
            ).toHaveBeenCalledWith(
                requester.id,
                baseTicket.id,
                [validFile, invalidFile]
            );
        });

        expect(
            await screen.findByText(
                /1 uploaded\. 1 rejected\./i
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                /installer\.exe: Unsupported file format/i
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText("1 / 5 active")
        ).toBeInTheDocument();
    });

    it("UI-035: previews an active image in an accessible modal", async () => {
        vi.mocked(getTicketDetail).mockResolvedValue({
            ...baseTicket,
            activeAttachments: [
                imageAttachment,
            ],
        });

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={baseTicket.id}
                onBack={vi.fn()}
            />
        );

        await screen.findByText(
            "screenshot.png"
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Preview",
            })
        );

        await waitFor(() => {
            expect(
                getAttachmentContent
            ).toHaveBeenCalledWith(
                requester.id,
                baseTicket.id,
                imageAttachment.id,
                true
            );
        });

        const dialog =
            await screen.findByRole("dialog");

        expect(dialog).toHaveAttribute(
            "aria-modal",
            "true"
        );

        expect(
            screen.getByRole("heading", {
                name: "screenshot.png",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("img", {
                name: "screenshot.png",
            })
        ).toHaveAttribute(
            "src",
            "blob:test-preview"
        );

        fireEvent.keyDown(document, {
            key: "Escape",
        });

        await waitFor(() => {
            expect(
                screen.queryByRole("dialog")
            ).not.toBeInTheDocument();
        });
    });

    it("UI-036: opens PDF using the browser instead of a custom PDF viewer", async () => {
        vi.mocked(getTicketDetail).mockResolvedValue({
            ...baseTicket,
            activeAttachments: [
                pdfAttachment,
            ],
        });

        vi.mocked(getAttachmentContent).mockResolvedValue(
            new Blob(["%PDF-1.4"], {
                type: "application/pdf",
            })
        );

        const clickSpy = vi
            .spyOn(
                HTMLAnchorElement.prototype,
                "click"
            )
            .mockImplementation(() => { });

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={baseTicket.id}
                onBack={vi.fn()}
            />
        );

        await screen.findByText(
            "evidence.pdf"
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Open",
            })
        );

        await waitFor(() => {
            expect(
                getAttachmentContent
            ).toHaveBeenCalledWith(
                requester.id,
                baseTicket.id,
                pdfAttachment.id,
                true
            );
        });

        expect(clickSpy).toHaveBeenCalled();

        expect(
            screen.queryByRole("img")
        ).not.toBeInTheDocument();

        clickSpy.mockRestore();
    });

    it("UI-037: Remove opens confirmation modal with required reason and counter", async () => {
        vi.mocked(getTicketDetail).mockResolvedValue({
            ...baseTicket,
            activeAttachments: [
                imageAttachment,
            ],
        });

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={baseTicket.id}
                onBack={vi.fn()}
            />
        );

        await screen.findByText(
            "screenshot.png"
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Remove",
            })
        );

        expect(
            screen.getByRole("dialog")
        ).toBeInTheDocument();

        expect(
            screen.getByRole("heading", {
                name: "Remove Attachment",
            })
        ).toBeInTheDocument();

        expect(
            screen.getAllByText(/screenshot\.png/i)
        ).toHaveLength(2);

        const reason =
            screen.getByLabelText(
                "Removal reason"
            );

        expect(reason).toBeInTheDocument();

        expect(
            screen.getByText("0 / 200")
        ).toBeInTheDocument();

        const confirmButton =
            screen.getByRole("button", {
                name: "Remove Attachment",
            });

        expect(confirmButton).toBeDisabled();

        fireEvent.change(reason, {
            target: {
                value: "Wrong screenshot",
            },
        });

        expect(
            screen.getByText("16 / 200")
        ).toBeInTheDocument();

        expect(confirmButton).not.toBeDisabled();

        fireEvent.keyDown(document, {
            key: "Escape",
        });

        await waitFor(() => {
            expect(
                screen.queryByRole("dialog")
            ).not.toBeInTheDocument();
        });
    });

    it("UI-038: confirmed removal moves attachment into removed history", async () => {
        const initialTicket: TicketDetail = {
            ...baseTicket,
            activeAttachments: [
                imageAttachment,
            ],
            removedAttachments: [],
        };

        const updatedTicket: TicketDetail = {
            ...baseTicket,
            activeAttachments: [],
            removedAttachments: [
                removedAttachment,
            ],
        };

        vi.mocked(getTicketDetail)
            .mockResolvedValueOnce(initialTicket)
            .mockResolvedValueOnce(updatedTicket);

        vi.mocked(
            removeTicketAttachment
        ).mockResolvedValue(
            removedAttachment
        );

        render(
            <TicketDetailScreen
                currentRequester={requester}
                ticketId={baseTicket.id}
                onBack={vi.fn()}
            />
        );

        await screen.findByText(
            "screenshot.png"
        );

        expect(
            screen.getByText("1 / 5 active")
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Remove",
            })
        );

        fireEvent.change(
            screen.getByLabelText(
                "Removal reason"
            ),
            {
                target: {
                    value:
                        "Uploaded the wrong screenshot",
                },
            }
        );

        fireEvent.click(
            screen.getByRole("button", {
                name: "Remove Attachment",
            })
        );

        await waitFor(() => {
            expect(
                removeTicketAttachment
            ).toHaveBeenCalledWith(
                requester.id,
                baseTicket.id,
                imageAttachment.id,
                "Uploaded the wrong screenshot"
            );
        });

        expect(
            await screen.findByText(
                "Attachment removed successfully."
            )
        ).toBeInTheDocument();

        expect(
            screen.getByText("0 / 5 active")
        ).toBeInTheDocument();

        expect(
            screen.getByRole("heading", {
                name:
                    "Removed Attachments (History)",
            })
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "Uploaded the wrong screenshot"
            )
        ).toBeInTheDocument();

        expect(
            screen.queryByRole("button", {
                name: "Preview",
            })
        ).not.toBeInTheDocument();

        expect(
            screen.queryByRole("button", {
                name: "Download",
            })
        ).not.toBeInTheDocument();
    });
});