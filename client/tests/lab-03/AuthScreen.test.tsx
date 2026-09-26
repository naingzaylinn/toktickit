import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthScreen from "../../src/components/AuthScreen.js";
import * as api from "../../src/api.js";

const user: api.AuthUser = { id: "user", name: "Test User", email: "test@example.com", role: "REQUESTER", isActive: true, mustChangePassword: true };
beforeEach(() => vi.restoreAllMocks());

describe("authentication form accessibility and failure states", () => {
  it("labels login controls and displays a safe authentication failure", async () => {
    vi.spyOn(api, "login").mockRejectedValue(new api.ApiError("INVALID_CREDENTIALS", "Unable to sign in with these credentials.", 401));
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

const guidance = "Use 8–72 characters with at least one letter and one number.";
function fillPasswords(next = "Changed123", confirm = next, current = "Initial123") {
  fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: confirm } });
}
const submitPassword = () => fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

describe("mandatory password validation", () => {
  it("describes the policy before submission without imposing extra composition rules", () => {
    render(<AuthScreen user={user} onAuthenticated={vi.fn()} onLogout={vi.fn()} />);
    expect(screen.getByText(guidance)).toBeVisible();
    expect(screen.getByLabelText("New Password")).toHaveAccessibleDescription(guidance);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["abcdef1", "a".repeat(72) + "1", "12345678", "abcdefgh"])("rejects invalid password %s beside New Password", value => {
    const change = vi.spyOn(api, "changePassword");
    render(<AuthScreen user={user} onAuthenticated={vi.fn()} onLogout={vi.fn()} />);
    fillPasswords(value);
    submitPassword();
    const input = screen.getByLabelText("New Password");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "auth-new-password-helper auth-new-password-error");
    expect(document.getElementById("auth-new-password-error")).toHaveTextContent(guidance);
    expect(screen.getByLabelText("Confirm New Password")).not.toHaveAttribute("aria-invalid");
    expect(change).not.toHaveBeenCalled();
  });

  it.each(["abcdefg1", "a".repeat(71) + "1", "é".repeat(71) + "1", "𐐀".repeat(71) + "1"])("accepts valid ASCII/Unicode boundaries and clears secrets: %s", async value => {
    const change = vi.spyOn(api, "changePassword").mockResolvedValue({ message: "Password changed successfully." });
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ ...user, mustChangePassword: false });
    const authenticated = vi.fn();
    render(<AuthScreen user={user} onAuthenticated={authenticated} onLogout={vi.fn()} />);
    fillPasswords(value);
    submitPassword();
    await waitFor(() => expect(authenticated).toHaveBeenCalledWith({ ...user, mustChangePassword: false }));
    expect(change).toHaveBeenCalledWith("Initial123", value, value);
    for (const label of ["Current Password", "New Password", "Confirm New Password"]) expect(screen.getByLabelText(label)).toHaveValue("");
  });

  it("associates missing current password and mismatch with their own controls", () => {
    const change = vi.spyOn(api, "changePassword");
    render(<AuthScreen user={user} onAuthenticated={vi.fn()} onLogout={vi.fn()} />);
    fillPasswords("Changed123", "Different123", "");
    submitPassword();
    expect(screen.getByLabelText("Current Password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Current Password")).toHaveAccessibleDescription(/Current password is required/);
    expect(screen.getByLabelText("Confirm New Password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Confirm New Password")).toHaveAccessibleDescription(/must match/);
    expect(screen.getByLabelText("New Password")).not.toHaveAttribute("aria-invalid");
    expect(change).not.toHaveBeenCalled();
  });

  it("keeps the save action busy and blocks repeat form submission until the session refresh finishes", async () => {
    let finish!: (value: { message: string }) => void;
    let refresh!: (value: api.AuthUser) => void;
    const change = vi.spyOn(api, "changePassword").mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    vi.spyOn(api, "getCurrentUser").mockImplementation(() => new Promise(resolve => { refresh = resolve; }));
    const authenticated = vi.fn();
    render(<AuthScreen user={user} onAuthenticated={authenticated} onLogout={vi.fn()} />);
    fillPasswords();
    submitPassword();
    const button = screen.getByRole("button", { name: "Saving..." });
    expect(button).toBeDisabled();
    expect(button.closest("form")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    fireEvent.submit(button.closest("form")!);
    expect(change).toHaveBeenCalledOnce();
    await act(async () => finish({ message: "Password changed successfully." }));
    fireEvent.submit(button.closest("form")!);
    expect(change).toHaveBeenCalledOnce();
    expect(authenticated).not.toHaveBeenCalled();
    await act(async () => refresh({ ...user, mustChangePassword: false }));
    expect(authenticated).toHaveBeenCalledOnce();
  });

  it("maps incorrect-current-password and backend field errors to their controls", async () => {
    const change = vi.spyOn(api, "changePassword")
      .mockRejectedValueOnce(new api.ApiError("INVALID_CURRENT_PASSWORD", "Current password is incorrect.", 401))
      .mockRejectedValueOnce(new api.ApiError("VALIDATION_ERROR", "One or more fields are invalid.", 400, undefined, { newPassword: guidance }));
    render(<AuthScreen user={user} onAuthenticated={vi.fn()} onLogout={vi.fn()} />);
    fillPasswords();
    submitPassword();
    await waitFor(() => expect(screen.getByLabelText("Current Password")).toHaveAccessibleDescription(/incorrect/));
    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "Correct123" } });
    submitPassword();
    await waitFor(() => expect(screen.getByLabelText("New Password")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Current Password")).not.toHaveAttribute("aria-invalid");
    expect(change).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new Error("network implementation detail"), "Unable to change your password. Please try again."],
    [new api.ApiError("INTERNAL_SERVER_ERROR", "Unable to complete the request.", 500), "Unable to complete the request."],
  ])("shows safe failure feedback and permits recovery", async (failure, message) => {
    const change = vi.spyOn(api, "changePassword").mockRejectedValueOnce(failure).mockResolvedValue({ message: "Password changed successfully." });
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({ ...user, mustChangePassword: false });
    const authenticated = vi.fn();
    render(<AuthScreen user={user} onAuthenticated={authenticated} onLogout={vi.fn()} />);
    fillPasswords();
    submitPassword();
    expect(await screen.findByRole("alert")).toHaveTextContent(message as string);
    expect(screen.queryByText("network implementation detail")).not.toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toHaveValue("Changed123");
    expect(screen.getByRole("button", { name: "Change Password" })).toBeEnabled();
    expect(authenticated).not.toHaveBeenCalled();
    submitPassword();
    await waitFor(() => expect(authenticated).toHaveBeenCalledOnce());
    expect(change).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
