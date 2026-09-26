import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserManagementScreen from "../../src/components/UserManagementScreen.js";
import type { AuthUser } from "../../src/api.js";

const admin: AuthUser = { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false };
const alice = { ...admin, id: "alice", name: "Alice", email: "alice@example.com", role: "REQUESTER" as const };
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
let scrollIntoView: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
beforeEach(() => {
  scrollIntoView = vi.fn(function (this: HTMLElement) { expect(this.isConnected).toBe(true); });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
  fetchMock = vi.fn().mockResolvedValue(ok([alice]));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

describe("User Management", () => {
  it("renders list, search, role filter, and no-results state", async () => {
    render(<UserManagementScreen currentUser={admin} />);
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search by name or email"), { target: { value: "none" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("search=none"))).toBe(true));
    fetchMock.mockResolvedValue(ok([]));
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "IT_STAFF" } });
    expect(await screen.findByText("No users match your search or filter.")).toBeInTheDocument();
  });
  it("creates a user and clears the initial password", async () => {
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.change(screen.getByLabelText("Initial Password"), { target: { value: "Initial123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === "/api/admin/users" && options?.method === "POST")).toBe(true));
    expect(await screen.findByText("User created.")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Initial123")).not.toBeInTheDocument();
  });
  it("supports edit and password reset", async () => {
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === "/api/admin/users/alice" && options?.method === "PATCH")).toBe(true));
    fireEvent.click(await screen.findByRole("button", { name: "Set initial password" }));
    fireEvent.change(screen.getByLabelText("New initial password"), { target: { value: "NewPass123" } });
    fireEvent.change(screen.getByLabelText("Confirm initial password"), { target: { value: "NewPass123" } });
    fireEvent.click(screen.getByRole("button", { name: "Set Password" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === "/api/admin/users/alice/initial-password")).toBe(true));
    expect(screen.queryByDisplayValue("NewPass123")).not.toBeInTheDocument();
  });
  it("shows forbidden access without loading users", () => {
    render(<UserManagementScreen currentUser={{ ...admin, role: "IT_STAFF" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("not permitted");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("shows a load failure without an empty or success state and retries", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    render(<UserManagementScreen currentUser={admin} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load users");
    expect(screen.queryByText("No users are available.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Alice")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("clears prior success feedback when the post-save list refresh fails", async () => {
    let listCalls = 0;
    fetchMock.mockImplementation((_url, options) => {
      if (options?.method === "POST") return Promise.resolve(ok(alice));
      listCalls += 1;
      return listCalls === 1 ? Promise.resolve(ok([alice])) : Promise.reject(new Error("network unavailable"));
    });
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.change(screen.getByLabelText("Initial Password"), { target: { value: "Initial123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load users");
    expect(screen.queryByText("User created.")).not.toBeInTheDocument();
    expect(screen.queryByText("No users are available.")).not.toBeInTheDocument();
  });
  it("keeps edit and password forms separate and confirms deactivation", async () => {
    const confirmation = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirmation);
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Set initial password" }));
    expect(screen.queryByRole("heading", { name: "Edit Alice" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByRole("heading", { name: "Set initial password for Alice" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url === "/api/admin/users/alice" && JSON.parse(options.body).isActive === false)).toBe(true));
    expect(confirmation).toHaveBeenCalled();
  });
});

describe("Administrator form validation", () => {
  it("associates create errors with name, email and initial password without sending a request", async () => {
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invalid-email" } });
    fireEvent.change(screen.getByLabelText("Initial Password"), { target: { value: "abcdefgh" } });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    for (const [label, message] of [["Name", /Name is required/], ["Email", /valid email/], ["Initial Password", /at least one letter and one number/]] as const) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("aria-invalid", "true");
      expect(field).toHaveAccessibleDescription(message);
    }
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.change(screen.getByLabelText("Initial Password"), { target: { value: "abcdefg1" } });
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByText("User created.")).toBeInTheDocument();
  });
  it("validates edited identity without requiring a replacement password", async () => {
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(/Name is required/);
    expect(screen.queryByLabelText("Initial Password")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByText("User updated.")).toBeInTheDocument();
  });
  it("separates password policy and confirmation errors and clears them between forms", async () => {
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Alice");
    fireEvent.click(screen.getByRole("button", { name: "Set initial password" }));
    fireEvent.change(screen.getByLabelText("New initial password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm initial password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Set Password" }));
    expect(screen.getByLabelText("New initial password")).toHaveAccessibleDescription(/at least one letter and one number/);
    expect(screen.getByLabelText("Confirm initial password")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Confirm initial password")).toHaveAccessibleDescription(/must match/);
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/initial-password"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Set initial password" }));
    expect(screen.getByLabelText("New initial password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm initial password")).not.toHaveAttribute("aria-invalid");
  });
  it("keeps self-deactivation disabled and displays last-administrator rejection safely", async () => {
    fetchMock.mockResolvedValue(ok([admin]));
    render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Admin");
    expect(screen.getByRole("button", { name: "Deactivate" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getAllByLabelText("Role")[1], { target: { value: "REQUESTER" } });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { code: "LAST_ACTIVE_ADMINISTRATOR", message: "The last active Administrator cannot be removed." } }) });
    fireEvent.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The last active Administrator cannot be removed.");
    expect(screen.getByRole("button", { name: "Save User" })).toBeEnabled();
  });
});

const formActions = [
  { action: "Edit", heading: "Edit Bob", field: "Name", initial: "Bob", submit: "Save User", invalid: "" },
  { action: "Set initial password", heading: "Set initial password for Bob", field: "New initial password", initial: "", submit: "Set Password", invalid: "short" },
] as const;
const bob = { ...alice, id: "bob", name: "Bob", email: "bob@example.com" };

describe("Administrator form activation", () => {
  for (const mode of ["mouse", "keyboard"] as const) {
    it.each(formActions)(`${mode}: $action reveals and focuses the selected user's rendered form; Cancel closes it`, async ({ action, heading, field, initial }) => {
      fetchMock.mockResolvedValue(ok([alice, bob]));
      const user = userEvent.setup();
      render(<UserManagementScreen currentUser={admin} />);
      await screen.findByText("Bob");
      expect(scrollIntoView).not.toHaveBeenCalled();
      const trigger = screen.getAllByRole("button", { name: action })[1];
      if (mode === "keyboard") { trigger.focus(); await user.keyboard("{Enter}"); }
      else await user.click(trigger);
      const title = screen.getByRole("heading", { name: heading });
      expect(title).toHaveFocus();
      expect(title).toHaveAttribute("tabindex", "-1");
      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(scrollIntoView.mock.contexts[0]).toBe(title);
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "instant" });
      expect(screen.getByLabelText(field)).toHaveValue(initial);
      await user.tab();
      expect(screen.getByLabelText(field)).toHaveFocus();

      fireEvent.change(screen.getByLabelText(field), { target: { value: "Unsaved123" } });
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "POST" || options?.method === "PATCH")).toHaveLength(0);
      await user.click(trigger);
      expect(screen.getByRole("heading", { name: heading })).toHaveFocus();
      expect(screen.getByLabelText(field)).toHaveValue(initial);
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
      // Re-activating the already open target still reveals it.
      await user.click(trigger);
      expect(screen.getByRole("heading", { name: heading })).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledTimes(3);
    });
  }

  it.each(formActions)("$action does not refocus or scroll on validation, search, filters or list updates", async ({ action, heading, field, submit, invalid }) => {
    fetchMock.mockResolvedValue(ok([bob]));
    const { rerender } = render(<UserManagementScreen currentUser={admin} />);
    await screen.findByText("Bob");
    fireEvent.click(screen.getByRole("button", { name: action }));
    const input = screen.getByLabelText(field);
    input.focus();
    fireEvent.change(input, { target: { value: invalid } });
    fireEvent.click(screen.getByRole("button", { name: submit }));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
    rerender(<UserManagementScreen currentUser={{ ...admin, name: "Administrator Updated" }} />);
    expect(input).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();

    const search = screen.getByLabelText("Search by name or email");
    search.focus();
    fireEvent.change(search, { target: { value: "Bob" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("search=Bob"))).toBe(true));
    await screen.findByRole("button", { name: action });
    expect(search).toHaveFocus();
    const filter = screen.getAllByRole("combobox", { name: "Role" })[0];
    filter.focus();
    fireEvent.change(filter, { target: { value: "REQUESTER" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("role=REQUESTER"))).toBe(true));
    await screen.findByRole("button", { name: action });
    expect(filter).toHaveFocus();

    vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await screen.findByText("User deactivated.");
    await screen.findByRole("button", { name: action });
    expect(screen.getByRole("heading", { name: heading })).not.toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
  });
});
