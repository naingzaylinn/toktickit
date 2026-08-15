import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

describe("App", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  // Issue 4 — write these yourself. Hint: mock the api module with
  // vi.spyOn(api, "checkSystem").mockResolvedValue(...) / .mockRejectedValue(...)
  // then click the button and assert the Online list / Offline message.
  it("shows Online and the seeded categories on success", async () => {
    const mockCategories = [
      { id: 1, name: "Account and Access" },
      { id: 2, name: "Hardware" },
      { id: 3, name: "Software" },
      { id: 4, name: "Network" },
    ];
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      categories: mockCategories,
    });

    render(<App />);
    const button = screen.getByRole("button", { name: /Check System/i });
    await userEvent.click(button);

    expect(await screen.findByText("Online")).toBeInTheDocument();
    for (const cat of mockCategories) {
      expect(screen.getByText(cat.name)).toBeInTheDocument();
    }
  });

  it("shows an Offline error message when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(
      new Error("Health check failed with status 500")
    );

    render(<App />);
    const button = screen.getByRole("button", { name: /Check System/i });
    await userEvent.click(button);

    expect(await screen.findByText("Offline")).toBeInTheDocument();
    expect(screen.getByText("Health check failed with status 500")).toBeInTheDocument();
  });
});

