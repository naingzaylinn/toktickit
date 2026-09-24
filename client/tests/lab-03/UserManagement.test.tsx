import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserManagementScreen from "../../src/components/UserManagementScreen.js";
import type { AuthUser } from "../../src/api.js";

const admin: AuthUser = { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMINISTRATOR", isActive: true, mustChangePassword: false };
const alice = { ...admin, id: "alice", name: "Alice", email: "alice@example.com", role: "REQUESTER" as const };
let fetchMock: ReturnType<typeof vi.fn>;
const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(ok([alice]));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

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
