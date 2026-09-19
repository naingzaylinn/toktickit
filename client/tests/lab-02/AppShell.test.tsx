import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";
const alice: api.AuthUser = { id: "alice", name: "Alice", email: "alice@example.com", role: "REQUESTER", isActive: true, mustChangePassword: false };
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); window.history.pushState({}, "", "/tickets"); vi.spyOn(api, "getMyTickets").mockResolvedValue({ data: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }); vi.spyOn(api, "getTicketCategories").mockResolvedValue([]); vi.spyOn(api, "getRelatedSystems").mockResolvedValue([]); });
describe("Authenticated shell replaces selector", () => {
    it("a delayed session response cannot restore the shell after logout", async () => {
        let finishRefresh!: (user: api.AuthUser) => void;
        let finishLogout!: (value: unknown) => void;
        vi.spyOn(api, "getCurrentUser").mockResolvedValueOnce(alice)
            .mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve; }));
        vi.spyOn(api, "logout").mockImplementationOnce(() => new Promise(resolve => { finishLogout = resolve; }));
        render(<App />);
        await userEvent.click(await screen.findByRole("button", { name: "Logout" }));
        act(() => { window.dispatchEvent(new Event("session-access-changed")); });
        await act(async () => { finishLogout({}); });
        await act(async () => { finishRefresh(alice); });
        expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
    it("an older session response cannot override a newer mandatory-password restriction", async () => {
        let finishOlder!: (user: api.AuthUser) => void;
        let finishNewer!: (user: api.AuthUser) => void;
        vi.spyOn(api, "getCurrentUser").mockResolvedValueOnce(alice)
            .mockImplementationOnce(() => new Promise(resolve => { finishOlder = resolve; }))
            .mockImplementationOnce(() => new Promise(resolve => { finishNewer = resolve; }));
        render(<App />);
        await screen.findByRole("navigation");
        act(() => {
            window.dispatchEvent(new Event("session-access-changed"));
            window.dispatchEvent(new Event("session-access-changed"));
        });
        await act(async () => { finishNewer({ ...alice, mustChangePassword: true }); });
        await act(async () => { finishOlder(alice); });
        expect(screen.getByRole("heading", { name: "Change Password" })).toBeInTheDocument();
        expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
    it("restores server identity and ignores old selector storage", async () => { sessionStorage.setItem("toktickit_requester_id", "bob"); vi.spyOn(api, "getCurrentUser").mockResolvedValue(alice); render(<App />); expect(await screen.findByText("Requester: Alice")).toBeInTheDocument(); expect(screen.queryByText(/Development Requester Selection|Change Requester/)).not.toBeInTheDocument(); expect(screen.queryByRole("link", { name: "Ticket Queue" })).not.toBeInTheDocument(); });
    it("invalid session cannot restore identity from storage", async () => { sessionStorage.setItem("toktickit_requester_id", "alice"); vi.spyOn(api, "getCurrentUser").mockRejectedValue(new api.ApiError("AUTHENTICATION_REQUIRED", "Sign in.", 401)); render(<App />); expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument(); expect(screen.queryByRole("navigation")).not.toBeInTheDocument(); });
    it("logs out and removes protected content including browser-back navigation", async () => { vi.spyOn(api, "getCurrentUser").mockResolvedValue(alice); const logout = vi.spyOn(api, "logout").mockResolvedValue({}); render(<App />); await userEvent.click(await screen.findByRole("button", { name: "Logout" })); expect(logout).toHaveBeenCalledOnce(); expect(await screen.findByRole("heading", { name: "Login" })).toBeInTheDocument(); expect(screen.queryByRole("navigation")).not.toBeInTheDocument(); });
    it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("renders only permitted navigation for %s", async (role) => { vi.spyOn(api, "getCurrentUser").mockResolvedValue({ ...alice, role }); render(<App />); expect(await screen.findByRole("link", { name: "Ticket Queue" })).toBeInTheDocument(); expect(screen.queryByRole("link", { name: "Create Ticket" })).not.toBeInTheDocument(); expect(Boolean(screen.queryByRole("link", { name: "User Management" }))).toBe(role === "ADMINISTRATOR"); expect(api.getMyTickets).not.toHaveBeenCalled(); });
    it("password change blocks normal navigation", async () => { vi.spyOn(api, "getCurrentUser").mockResolvedValue({ ...alice, mustChangePassword: true }); render(<App />); expect(await screen.findByRole("heading", { name: "Change Password" })).toBeInTheDocument(); expect(screen.queryByRole("navigation")).not.toBeInTheDocument(); });
    it("logout failure remains visible", async () => { vi.spyOn(api, "getCurrentUser").mockResolvedValue(alice); vi.spyOn(api, "logout").mockRejectedValue(new Error()); render(<App />); await userEvent.click(await screen.findByRole("button", { name: "Logout" })); expect(await screen.findByRole("alert")).toHaveTextContent("Unable to log out"); });
});
