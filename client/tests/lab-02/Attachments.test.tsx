import React from "react";
import {
    act,
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
import userEvent from "@testing-library/user-event";
import { ApiError } from "../../src/api.js";

vi.mock("../../src/api.js", async () => {
    const actual =
        await vi.importActual<typeof import("../../src/api.js")>(
            "../../src/api.js"
        );

    return {
        ...actual,
        getTicketDetail: vi.fn(),
        getActions: vi.fn().mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } }),
        getComments: vi.fn().mockResolvedValue([]),
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
    it("FB-01: rapid attachment-review clicks start one GET and never repeat the write", async () => {
        const view = await showImage(); vi.mocked(uploadTicketAttachments).mockRejectedValue(new Error("response lost"));
        fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File(["ok"], "new.png", { type: "image/png" })] } });
        const retry = await screen.findByRole("button", { name: "Refresh attachments for review" });
        let finish!: (value: TicketDetail) => void; vi.mocked(getTicketDetail).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        act(() => { fireEvent.click(retry); fireEvent.click(retry); });
        expect(getTicketDetail).toHaveBeenCalledTimes(2);
        await act(async () => finish({ ...baseTicket, activeAttachments: [imageAttachment] }));
        expect(uploadTicketAttachments).toHaveBeenCalledTimes(1);
    });
    it("AX-02: server reason validation retains the dialog/draft and focuses its field", async () => {
        await showImage(); vi.mocked(removeTicketAttachment).mockRejectedValue(new ApiError("VALIDATION_ERROR", "Reason cannot contain a null character.", 400));
        const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Remove" }));
        const reason = screen.getByLabelText("Removal reason"); await user.type(reason, "Retained reason"); await user.click(screen.getByRole("button", { name: "Remove Attachment" }));
        await waitFor(() => expect(reason).toHaveFocus()); expect(reason).toHaveAccessibleDescription(/null character/); expect(reason).toHaveValue("Retained reason"); expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("alert"));
    });
    const showImage = async () => {
        vi.mocked(getTicketDetail).mockResolvedValue({ ...baseTicket, activeAttachments: [imageAttachment] });
        const view = render(<TicketDetailScreen currentRequester={requester} ticketId={baseTicket.id} onBack={vi.fn()} />);
        await screen.findByText("screenshot.png"); return view;
    };
    it("AX-01: preview traps both Tab directions and restores its trigger on Escape", async () => {
        await showImage(); const user = userEvent.setup(); const trigger = screen.getByRole("button", { name: "Preview" }); await user.click(trigger);
        const close = await screen.findByRole("button", { name: "Close preview" }); expect(close).toHaveFocus();
        await user.tab(); expect(close).toHaveFocus(); await user.tab({ shift: true }); expect(close).toHaveFocus();
        expect(screen.getByRole("dialog")).toHaveAccessibleName("screenshot.png");
        await user.keyboard("{Escape}"); expect(trigger).toHaveFocus();
    });
    it("AX-01/02: removal links validation inside the dialog and restores Cancel", async () => {
        await showImage(); const user = userEvent.setup(); const trigger = screen.getByRole("button", { name: "Remove" }); await user.click(trigger);
        const reason = screen.getByLabelText("Removal reason"); expect(reason).toHaveFocus();
        fireEvent.change(reason, { target: { value: "x".repeat(201) } });
        await user.click(screen.getByRole("button", { name: "Remove Attachment" }));
        expect(reason).toHaveAttribute("aria-invalid", "true"); expect(reason).toHaveAccessibleDescription(/1 and 200/); expect(reason).toHaveFocus();
        expect(screen.getByRole("dialog")).toContainElement(screen.getByRole("alert"));
        await user.click(screen.getByRole("button", { name: "Cancel" })); expect(trigger).toHaveFocus();
    });
    it("AX-01: removal restores stable heading when its trigger disappears", async () => {
        await showImage(); vi.mocked(removeTicketAttachment).mockResolvedValue(removedAttachment);
        vi.mocked(getTicketDetail).mockResolvedValue({ ...baseTicket, removedAttachments: [removedAttachment] });
        const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Remove" }));
        await user.type(screen.getByLabelText("Removal reason"), "Wrong file"); await user.click(screen.getByRole("button", { name: "Remove Attachment" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getByRole("heading", { name: "Attachments" })).toHaveFocus();
    });
    it("AX-01: Escape cannot dismiss busy removal; all-disabled Tab stays in the dialog", async () => {
        await showImage(); let finish!: (value: TicketAttachment) => void; vi.mocked(removeTicketAttachment).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const user = userEvent.setup(); await user.click(screen.getByRole("button", { name: "Remove" })); await user.type(screen.getByLabelText("Removal reason"), "Wrong file");
        await user.click(screen.getByRole("button", { name: "Remove Attachment" })); await user.keyboard("{Escape}"); expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
        await user.tab(); expect(screen.getByRole("dialog")).toHaveFocus();
        finish(removedAttachment); await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
    it.each(["upload", "removal"])("FB-01: confirmed %s survives failed refresh and Retry sends only GET", async operation => {
        const view = await showImage(); vi.mocked(getTicketDetail).mockRejectedValueOnce(new Error("GET failed"));
        vi.mocked(uploadTicketAttachments).mockResolvedValue({ accepted: [imageAttachment], rejected: [], activeAttachmentCount: 1 }); vi.mocked(removeTicketAttachment).mockResolvedValue(removedAttachment);
        if (operation === "upload") fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File(["ok"], "new.png", { type: "image/png" })] } });
        else { fireEvent.click(screen.getByRole("button", { name: "Remove" })); fireEvent.change(screen.getByLabelText("Removal reason"), { target: { value: "Wrong file" } }); fireEvent.click(screen.getByRole("button", { name: "Remove Attachment" })); }
        expect(await screen.findByText(/write succeeded, but refresh failed/)).toHaveAttribute("role", "alert");
        expect(screen.getByRole("status")).toHaveTextContent(operation === "upload" ? "uploaded successfully" : "removed successfully");
        fireEvent.click(screen.getByRole("button", { name: "Refresh attachments for review" }));
        await waitFor(() => expect(screen.queryByText(/write succeeded, but refresh failed/)).not.toBeInTheDocument());
        expect(operation === "upload" ? uploadTicketAttachments : removeTicketAttachment).toHaveBeenCalledTimes(1);
    });
    it.each(["upload", "removal"])("FB-01: uncertain %s blocks blind retries until explicit GET review", async operation => {
        const view = await showImage(); vi.mocked(uploadTicketAttachments).mockRejectedValue(new Error("response lost")); vi.mocked(removeTicketAttachment).mockRejectedValue(new Error("response lost"));
        const input = view.container.querySelector('input[type=file]')!;
        if (operation === "upload") fireEvent.change(input, { target: { files: [new File(["ok"], "new.png", { type: "image/png" })] } });
        else { fireEvent.click(screen.getByRole("button", { name: "Remove" })); fireEvent.change(screen.getByLabelText("Removal reason"), { target: { value: "Wrong file" } }); fireEvent.click(screen.getByRole("button", { name: "Remove Attachment" })); }
        expect(await screen.findByText(/outcome could not be confirmed/)).toBeInTheDocument();
        expect(input).toBeDisabled(); expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
        fireEvent.change(input, { target: { files: [new File(["ok"], "new.png", { type: "image/png" })] } });
        expect(operation === "upload" ? uploadTicketAttachments : removeTicketAttachment).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "Refresh attachments for review" })); await waitFor(() => expect(input).not.toBeDisabled());
        expect(operation === "upload" ? uploadTicketAttachments : removeTicketAttachment).toHaveBeenCalledTimes(1);
    });
    it("FB-01: definitive upload rejection reports failure without fabricated success", async () => {
        const view = await showImage(); vi.mocked(uploadTicketAttachments).mockRejectedValue(new ApiError("VALIDATION_ERROR", "Invalid file.", 400));
        fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File(["bad"], "bad.png", { type: "image/png" })] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("Invalid file."); expect(screen.queryByText(/uploaded successfully/)).not.toBeInTheDocument(); expect(getTicketDetail).toHaveBeenCalledTimes(1);
    });
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
                baseTicket.id,
                [validFile, invalidFile],
                expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) })
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
                baseTicket.id,
                imageAttachment.id,
                true,
                expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) })
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
                baseTicket.id,
                pdfAttachment.id,
                true,
                expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) })
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
                baseTicket.id,
                imageAttachment.id,
                "Uploaded the wrong screenshot",
                expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) })
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
