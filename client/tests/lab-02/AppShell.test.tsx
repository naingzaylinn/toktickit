import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("Feature-A: Requester Context Restoration & Switching Tests", () => {
  const ALICE: api.DevelopmentRequester = {
    id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Alice Developer",
    email: "alice@kmutt.ac.th",
  };

  const BOB: api.DevelopmentRequester = {
    id: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    name: "Bob Developer",
    email: "bob@kmutt.ac.th",
  };

  const activeRequesters = [ALICE, BOB];

  beforeEach(() => {
    sessionStorage.clear();
    window.history.pushState({}, "", "/");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // UI-004: Page reload with valid requester in sessionStorage restores context and renders AppShell
  it("UI-004: restores valid requester context on reload and renders active requester badge in AppShell", async () => {
    // Setup stored active requester ID
    sessionStorage.setItem(api.REQUESTER_STORAGE_KEY, ALICE.id);
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(activeRequesters);

    render(<App />);

    // AppShell header displays requester badge
    const badge = await screen.findByTestId("requester-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("Requester: Alice Developer");

    // Confirms no redirect to /requester-select
    expect(screen.queryByText("Development Requester Selection")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
  });

  // UI-005: App initialization with inactive or missing stored requester clears storage and redirects
  it("UI-005: clears sessionStorage and redirects to /requester-select when stored requester is inactive or missing", async () => {
    // Stored ID belongs to inactive or nonexistent user
    sessionStorage.setItem(api.REQUESTER_STORAGE_KEY, "nonexistent-or-inactive-uuid");
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(activeRequesters);

    render(<App />);

    // Should redirect to Requester Selection screen
    expect(await screen.findByText("Development Requester Selection")).toBeInTheDocument();

    // Storage is cleared
    expect(sessionStorage.getItem(api.REQUESTER_STORAGE_KEY)).toBeNull();

    // Explanatory alert banner is displayed
    expect(
      screen.getByText(/The previously selected Development Requester is no longer active or available/i)
    ).toBeInTheDocument();
  });

  // UI-006: Activating Change Requester executes switching workflow
  it("UI-006: activates Change Requester, switches identity, updates sessionStorage, and reloads context", async () => {
    // Initial active session with Alice
    sessionStorage.setItem(api.REQUESTER_STORAGE_KEY, ALICE.id);
    vi.spyOn(api, "getDevelopmentRequesters").mockResolvedValue(activeRequesters);

    render(<App />);

    // Verify Alice is active
    expect(await screen.findByText("Requester: Alice Developer")).toBeInTheDocument();

    // Click Change Requester button
    const changeBtn = screen.getByRole("button", { name: /Change Requester/i });
    await userEvent.click(changeBtn);

    // Navigates to Requester Selection view
    expect(await screen.findByText("Development Requester Selection")).toBeInTheDocument();

    // Select Bob from dropdown
    const select = screen.getByLabelText(/Development Requester/i);
    await userEvent.selectOptions(select, BOB.id);

    // Click Continue
    const continueBtn = screen.getByRole("button", { name: /Continue/i });
    await userEvent.click(continueBtn);

    // Storage now holds Bob's ID
    expect(sessionStorage.getItem(api.REQUESTER_STORAGE_KEY)).toBe(BOB.id);

    // Context reloaded with Bob
    expect(
      await screen.findByText("Requester: Bob Developer")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "My Tickets" })
    ).toBeInTheDocument();
  });
});
