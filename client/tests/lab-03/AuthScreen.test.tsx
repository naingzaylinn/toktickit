import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthScreen from "../../src/components/AuthScreen.js";
import * as api from "../../src/api.js";

const user: api.AuthUser = { id: "user", name: "Test User", email: "test@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true };
beforeEach(() => vi.restoreAllMocks());

describe("authentication form accessibility and failure states", () => {
  it("labels login controls and displays a safe authentication failure", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new Error("Unable to sign in with these credentials."));
    render(<AuthScreen user={null} onAuthenticated={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "test@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "Wrong123");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign in with these credentials.");
  });

  it("requires matching valid replacement passwords before calling the API", async () => {
    const change = vi.spyOn(api, "changePassword").mockResolvedValue({ message: "Password changed successfully." });
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ ...user, mustChangePassword: false });
    const authenticated = vi.fn();
    render(<AuthScreen user={user} onAuthenticated={authenticated} onLogout={vi.fn()} />);
    for (const label of ["Current Password", "New Password", "Confirm New Password"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Current Password"), "Initial123");
    await userEvent.type(screen.getByLabelText("New Password"), "Changed123");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "Different123");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("must match");
    expect(change).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByLabelText("Confirm New Password"));
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "Changed123");
    await userEvent.click(screen.getByRole("button", { name: "Change Password" }));
    expect(change).toHaveBeenCalledWith("Initial123", "Changed123", "Changed123");
    expect(authenticated).toHaveBeenCalledWith({ ...user, mustChangePassword: false });
  });
});
