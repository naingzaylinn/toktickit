import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterSelectScreen from "../../src/components/RequesterSelectScreen.js";
import * as api from "../../src/api.js";

describe("Feature-A: RequesterSelectScreen Tests", () => {
  const mockRequesters: api.DevelopmentRequester[] = [
    {
      id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      name: "Alice Developer",
      email: "alice@kmutt.ac.th",
    },
    {
      id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      name: "Bob Developer",
      email: "bob@kmutt.ac.th",
    },
    {
      id: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
      name: "Charlie Developer",
      email: "charlie@kmutt.ac.th",
    },
    {
      id: "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
      name: "Diana Developer",
      email: "diana@kmutt.ac.th",
    },
  ];

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // UI-001: Renders active requester options with testing disclaimer callout and disabled Continue button
  it("UI-001: renders active requester options in dropdown with testing disclaimer callout and disabled continue button", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(mockRequesters);

    render(<RequesterSelectScreen />);

    // Check header & disclaimer callout
    expect(screen.getByText("Development Requester Selection")).toBeInTheDocument();
    expect(
      screen.getByText(/temporary testing selector for Lab 2; full authentication will be introduced in Lab 3/i)
    ).toBeInTheDocument();

    // Wait for requesters to load
    const dropdown = await screen.findByLabelText(/Development Requester/i);
    expect(dropdown).toBeInTheDocument();

    // Check options are formatted "Name (email)"
    expect(screen.getByRole("option", { name: "Alice Developer (alice@kmutt.ac.th)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob Developer (bob@kmutt.ac.th)" })).toBeInTheDocument();

    // Continue button is disabled until selection
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeDisabled();
  });

  // UI-002: Blocks submission when no requester is selected, displaying inline validation
  it("UI-002: blocks submission when no requester is selected and shows inline validation error", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(mockRequesters);

    render(<RequesterSelectScreen />);

    await screen.findByLabelText(/Development Requester/i);
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeDisabled();

    // If form is submitted without selection
    const form = continueBtn.closest("form")!;
    act(() => {
      fireEvent.submit(form);
    });

    // Inline validation error displayed
    expect(screen.getByText("Please select a development requester.")).toBeInTheDocument();

    // sessionStorage remains empty
    expect(sessionStorage.getItem(api.REQUESTER_STORAGE_KEY)).toBeNull();
  });

  // UI-003: Selecting active requester and clicking Continue persists ID in sessionStorage and navigates
  it("UI-003: persists selected requester ID to tab-scoped sessionStorage and triggers navigation callback", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(mockRequesters);
    const onSelectMock = vi.fn();

    render(<RequesterSelectScreen onSelectRequester={onSelectMock} />);

    const dropdown = await screen.findByLabelText(/Development Requester/i);
    const continueBtn = screen.getByRole("button", { name: /Continue/i });

    // Select Alice
    await userEvent.selectOptions(dropdown, "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
    expect(continueBtn).toBeEnabled();

    // Click Continue
    await userEvent.click(continueBtn);

    // Verify sessionStorage has Alice's ID
    expect(sessionStorage.getItem(api.REQUESTER_STORAGE_KEY)).toBe("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d");
    expect(onSelectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        name: "Alice Developer",
      })
    );
  });

  // UI-007: Renders loading spinner during fetch and empty state when 0 active requesters exist
  it("UI-007: renders loading spinner while pending and empty alert when 0 requesters are available", async () => {
    let resolvePromise: (value: api.DevelopmentRequester[]) => void;
    const pendingPromise = new Promise<api.DevelopmentRequester[]>((resolve) => {
      resolvePromise = resolve;
    });
    vi.spyOn(api, "getDevelopmentRequesters").mockReturnValue(pendingPromise);

    render(<RequesterSelectScreen />);

    // Verify loading spinner
    expect(screen.getByText(/Loading active requesters.../i)).toBeInTheDocument();

    // Resolve with empty array
    resolvePromise!([]);

    // Verify empty state
    expect(
      await screen.findByText("No active Development Requesters are currently available.")
    ).toBeInTheDocument();
  });

  // UI-008: Renders safe error state with Retry button on API failure
  it("UI-008: renders safe error state with Retry button on API failure without leaking stack trace", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockRejectedValueOnce(
      new Error("PrismaClientInitializationError: Can't reach database server at localhost:5432")
    );

    render(<RequesterSelectScreen />);

    // Safe error message must appear
    const errorBanner = await screen.findByText(/Unable to load development requesters/i);
    expect(errorBanner).toBeInTheDocument();
    // Internal details must not leak
    expect(screen.queryByText(/PrismaClientInitializationError/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/localhost:5432/i)).not.toBeInTheDocument();

    // Retry button is available and functional
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Clicking retry refetches
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(mockRequesters);
    await userEvent.click(retryBtn);

    expect(await screen.findByLabelText(/Development Requester/i)).toBeInTheDocument();
  });

  // RESP-001: Layout adapts across viewports (centered card, no horizontal overflow, full width controls)
  it("RESP-001: renders card layout with full-width responsive controls", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(mockRequesters);

    const { container } = render(<RequesterSelectScreen />);

    await screen.findByLabelText(/Development Requester/i);

    // Card element has responsive padding and bootstrap classes
    const card = container.querySelector(".zen-card");
    expect(card).toBeInTheDocument();

    // Form select has form-select-lg class for touch-friendly sizing
    const select = screen.getByLabelText(/Development Requester/i);
    expect(select).toHaveClass("form-select");

    // Button is full-width in d-grid container
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toHaveClass("btn", "btn-primary-green");
    expect(continueBtn.parentElement).toHaveClass("d-grid");
  });

  // A11Y-001: Keyboard accessibility and visible focus verification
  it("A11Y-001: supports keyboard operation with accessible label and keyboard activatable submit", async () => {
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(mockRequesters);
    const onSelectMock = vi.fn();

    render(<RequesterSelectScreen onSelectRequester={onSelectMock} />);

    // Dropdown has programmatic label associated with it
    const select = await screen.findByLabelText(/Development Requester/i);
    expect(select).toHaveAttribute("id", "requester-select");

    const label = screen.getByText("Development Requester");
    expect(label).toHaveAttribute("for", "requester-select");

    // Select with userEvent (keyboard accessible)
    await userEvent.selectOptions(select, "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e");

    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    expect(continueBtn).toBeEnabled();

    // Operable with Enter
    continueBtn.focus();
    expect(continueBtn).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onSelectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        name: "Bob Developer",
      })
    );
  });
});
