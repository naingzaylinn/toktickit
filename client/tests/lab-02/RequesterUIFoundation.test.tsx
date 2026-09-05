import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "../../src/App.js";
import AppShell from "../../src/components/AppShell.js";
import LoadingSpinner from "../../src/components/common/LoadingSpinner.js";
import ErrorAlert from "../../src/components/common/ErrorAlert.js";
import EmptyState from "../../src/components/common/EmptyState.js";
import ConfirmModal from "../../src/components/common/ConfirmModal.js";
import StatusBadge from "../../src/components/common/StatusBadge.js";
import FormField from "../../src/components/common/FormField.js";

import * as api from "../../src/api.js";

describe("Feature-B: Requester UI Foundation Tests", () => {
    const ALICE: api.DevelopmentRequester = {
        id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        name: "Alice Developer",
        email: "alice@kmutt.ac.th",
    };

    beforeEach(() => {
        sessionStorage.clear();
        window.history.pushState({}, "", "/tickets");
        vi.restoreAllMocks();
    });

    afterEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    // UI-009
    it("UI-009: renders TokTickIT branding, requester navigation, and active requester badge", () => {
        render(
            <AppShell
                currentRequester={ALICE}
                onChangeRequester={vi.fn()}
                activePath="/tickets"
            >
                <div>Content</div>
            </AppShell>
        );

        const brand = screen.getByRole("link", { name: "TokTickIT" });
        expect(brand).toBeInTheDocument();
        expect(brand).toHaveAttribute("href", "/tickets");

        expect(
            screen.getByRole("link", { name: "My Tickets" })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: "Create Ticket" })
        ).toBeInTheDocument();

        const badge = screen.getByTestId("requester-badge");
        expect(badge).toHaveTextContent("Requester: Alice Developer");

        expect(
            screen.getByRole("button", { name: "Change Requester" })
        ).toBeInTheDocument();
    });

    // UI-010
    it("UI-010: keeps the AppShell mounted while navigating between requester routes", async () => {
        const user = userEvent.setup();

        sessionStorage.setItem(api.REQUESTER_STORAGE_KEY, ALICE.id);

        vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue([ALICE]);

        window.history.pushState({}, "", "/tickets");

        render(<App />);

        await screen.findByTestId("requester-badge");

        const originalNav = screen.getByRole("navigation", {
            name: /main navigation/i,
        });

        expect(
            screen.getByRole("heading", { name: "My Tickets" })
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("link", { name: "Create Ticket" })
        );

        expect(
            await screen.findByRole("heading", { name: "Create Ticket" })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("navigation", {
                name: /main navigation/i,
            })
        ).toBe(originalNav);

        await user.click(
            screen.getByRole("link", { name: "My Tickets" })
        );

        expect(
            await screen.findByRole("heading", { name: "My Tickets" })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("navigation", { name: /main navigation/i })
        ).toBe(originalNav);
    });

    // UI-011
    it("UI-011: LoadingSpinner renders an accessible loading state", () => {
        render(<LoadingSpinner />);

        const status = screen.getByRole("status");

        expect(status).toBeInTheDocument();
        expect(
            screen.getByText("Loading content, please wait...")
        ).toBeInTheDocument();
    });

    // UI-012
    it("UI-012: ErrorAlert renders a safe message and executes Retry action", async () => {
        const user = userEvent.setup();
        const retry = vi.fn();

        render(
            <ErrorAlert
                message="Unable to load content."
                onRetry={retry}
            />
        );

        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(
            screen.getByText("Unable to load content.")
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: /Retry/i })
        );

        expect(retry).toHaveBeenCalledTimes(1);
    });

    // UI-013
    it("UI-013: status and validation indicators do not rely on color alone", () => {
        const { container } = render(
            <>
                <StatusBadge
                    label="New"
                    variant="success"
                />

                <FormField
                    id="summary"
                    label="Summary"
                    required
                    error="Summary is required."
                >
                    <input className="form-control" />
                </FormField>
            </>
        );

        expect(screen.getByText("New")).toBeInTheDocument();

        const statusIcon = container.querySelector(
            ".status-badge [aria-hidden='true']"
        );
        expect(statusIcon).toBeInTheDocument();

        const input = screen.getByLabelText(/Summary/i);
        expect(input).toHaveAttribute("aria-invalid", "true");

        const error = screen.getByRole("alert");
        expect(error).toHaveTextContent("Summary is required.");
    });

    // RESP-002
    it("RESP-002: AppShell provides collapsible navigation for smaller viewports", async () => {
        const user = userEvent.setup();

        const { container } = render(
            <AppShell
                currentRequester={ALICE}
                onChangeRequester={vi.fn()}
            />
        );

        const toggle = screen.getByRole("button", {
            name: "Toggle navigation",
        });

        expect(toggle).toHaveAttribute("aria-expanded", "false");

        const collapse = container.querySelector(
            "#toktickit-navbar-nav"
        );

        expect(collapse).toBeInTheDocument();
        expect(collapse).not.toHaveClass("show");

        await user.click(toggle);

        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(collapse).toHaveClass("show");

        await user.click(toggle);

        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(collapse).not.toHaveClass("show");
    });

    // RESP-003
    it("RESP-003: AppShell uses the desktop horizontal navigation breakpoint", () => {
        const { container } = render(
            <AppShell
                currentRequester={ALICE}
                onChangeRequester={vi.fn()}
            />
        );

        const navbar = container.querySelector(".navbar");

        expect(navbar).toBeInTheDocument();
        expect(navbar).toHaveClass("navbar-expand-lg");

        expect(
            screen.getByRole("link", { name: "TokTickIT" })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: "My Tickets" })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", { name: "Create Ticket" })
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", { name: "Change Requester" })
        ).toBeInTheDocument();
    });

    // A11Y-002
    it("A11Y-002: requester navigation controls are keyboard focusable and accessible", async () => {
        const user = userEvent.setup();

        render(
            <AppShell
                currentRequester={ALICE}
                onChangeRequester={vi.fn()}
            />
        );

        const brand = screen.getByRole("link", {
            name: "TokTickIT",
        });

        brand.focus();
        expect(brand).toHaveFocus();

        const myTickets = screen.getByRole("link", {
            name: "My Tickets",
        });

        myTickets.focus();
        expect(myTickets).toHaveFocus();

        const createTicket = screen.getByRole("link", {
            name: "Create Ticket",
        });

        createTicket.focus();
        expect(createTicket).toHaveFocus();

        const changeRequester = screen.getByRole("button", {
            name: "Change Requester",
        });

        changeRequester.focus();
        expect(changeRequester).toHaveFocus();

        await user.keyboard("{Enter}");
    });

    it("generic EmptyState renders reusable content and action", async () => {
        const user = userEvent.setup();
        const action = vi.fn();

        render(
            <EmptyState
                title="Nothing here"
                description="There is currently no content."
                actionLabel="Try Again"
                onAction={action}
            />
        );

        expect(screen.getByText("Nothing here")).toBeInTheDocument();
        expect(
            screen.getByText("There is currently no content.")
        ).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Try Again" })
        );

        expect(action).toHaveBeenCalledTimes(1);
    });

    it("generic ConfirmModal supports confirm, cancel, and Escape", async () => {
        const user = userEvent.setup();

        const confirm = vi.fn();
        const cancel = vi.fn();

        render(
            <ConfirmModal
                open
                title="Confirm Action"
                message="Are you sure?"
                onConfirm={confirm}
                onCancel={cancel}
            />
        );

        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await user.click(
            screen.getByRole("button", { name: "Confirm" })
        );

        expect(confirm).toHaveBeenCalledTimes(1);

        await user.keyboard("{Escape}");

        expect(cancel).toHaveBeenCalledTimes(1);
    });
});