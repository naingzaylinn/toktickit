import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import App from "../../src/App.js";
import { postComment, indicateResolved, uploadTicketAttachments, removeTicketAttachment, type AuthUser } from "../../src/api.js";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const a: AuthUser = { id: "A", name: "Requester A", email: "a@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false };
const attachment = { id: "file", ticketId: "ticket", originalFilename: "private-A.png", mimeType: "image/png", sizeBytes: 10, createdAt: "2026-10-14T00:00:00Z", isRemoved: false };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

for (const [name, run] of [
  ["comment", (context?: Parameters<typeof postComment>[2]) => postComment("ticket", "Reply", context)],
  ["indication", (context?: Parameters<typeof postComment>[2]) => indicateResolved("ticket", context)],
  ["upload", (context?: Parameters<typeof postComment>[2]) => uploadTicketAttachments("ticket", [], context)],
  ["removal", (context?: Parameters<typeof postComment>[2]) => removeTicketAttachment("ticket", "file", "Wrong file", context)],
] as const) it.each([401, 403])(`O-01 ${name}: current and default %s denials still emit access loss`, async status => {
  for (const context of [undefined, { isCurrent: () => true }]) {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(json({ error: { code: status === 401 ? "AUTHENTICATION_REQUIRED" : "PASSWORD_CHANGE_REQUIRED" } }, status))));
    const events = vi.fn(); window.addEventListener("session-access-changed", events);
    try { await expect(run(context)).rejects.toMatchObject({ status }); expect(events).toHaveBeenCalledTimes(1); }
    finally { window.removeEventListener("session-access-changed", events); }
  }
});

for (const operation of ["comment", "indication", "upload", "removal"] as const) {
  it.each(["401", "403", "delayed-body", "success"])(`O-01 actual App: obsolete ${operation} %s cannot affect B`, async outcome => {
    window.history.replaceState({}, "", "/tickets/ticket");
    let actor = a, release!: (response: Response) => void, releaseBody!: () => void, enteredBody!: () => void;
    const held = new Promise<Response>(resolve => { release = resolve; });
    const bodyGate = new Promise<void>(resolve => { releaseBody = resolve; });
    const bodyStarted = new Promise<void>(resolve => { enteredBody = resolve; });
    const mutation = vi.fn();
    const detailReads = vi.fn();
    const oldResponse = { ok: false, status: 403, json: async () => { enteredBody(); await bodyGate; return { error: { code: "PASSWORD_CHANGE_REQUIRED" } }; }, clone() { return this; } } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
      if (url === "/api/auth/me") return Promise.resolve(json({ data: actor }));
      if (url === "/api/auth/logout") return Promise.resolve(json({ data: {} }));
      if (url === "/api/auth/login") { actor = { ...a, id: "B", name: "Requester B" }; return Promise.resolve(json({ data: { user: actor } })); }
      if (url === "/api/tickets/ticket") {
        detailReads();
        return Promise.resolve(json({ data: { id: "ticket", ticketNumber: "TKT-A", currentStatus: "New", requestedPriority: "Medium", summary: "Private A summary", description: "Private A description", requester: a, category: { id: 1, name: "Category" }, relatedSystem: { id: "system", name: "System" }, ticketDate: "2026-10-14T00:00:00Z", activeAttachments: [attachment], removedAttachments: [] } }));
      }
      if (options?.method === "POST" || options?.method === "DELETE") { mutation(); return held; }
      if (url.endsWith("/categories")) return Promise.resolve(json({ data: [{ id: 1, name: "Category" }] }));
      if (url.endsWith("/related-systems")) return Promise.resolve(json({ data: [{ id: "system", name: "System" }] }));
      return Promise.resolve(json({ data: [], meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }, pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } }));
    }));
    const view = render(<App />);
    await screen.findByText("Private A summary");
    await screen.findByText("No Public Comments yet.");
    if (operation === "comment") {
      fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Private A draft" } });
      fireEvent.click(screen.getByRole("button", { name: "Submit Comment" }));
    } else if (operation === "indication") fireEvent.click(screen.getByRole("button", { name: "Problem Appears Resolved" }));
    else if (operation === "upload") fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(["A"], "private-A.png", { type: "image/png" })] } });
    else {
      fireEvent.click(screen.getByRole("button", { name: "Remove" }));
      fireEvent.change(screen.getByLabelText(/Removal reason/), { target: { value: "Private A reason" } });
      fireEvent.click(screen.getByRole("button", { name: "Remove Attachment" }));
    }
    await waitFor(() => expect(mutation).toHaveBeenCalledTimes(1));
    if (outcome === "delayed-body") { await act(async () => release(oldResponse)); await bodyStarted; }
    // A native modal intentionally traps keyboard focus; explicit logout here
    // simulates navigation/access replacement while the mutation is in flight.
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await screen.findByRole("heading", { name: "Login" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "b@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Initial123" } });
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByRole("heading", { name: "My Tickets" });
    const events = vi.fn(); window.addEventListener("session-access-changed", events);
    const readsBefore = detailReads.mock.calls.length;
    try {
      await act(async () => {
        if (outcome === "delayed-body") releaseBody();
        else release(outcome === "success" ? json({ data: operation === "upload" ? { accepted: [attachment], rejected: [] } : operation === "comment" ? { id: "comment", content: "Private A draft", author: a, createdAt: "2026-10-14T00:00:00Z" } : operation === "indication" ? { problemAppearsResolvedAt: "2026-10-14T00:00:00Z" } : attachment }) : json({ error: { code: outcome === "401" ? "AUTHENTICATION_REQUIRED" : "PASSWORD_CHANGE_REQUIRED" } }, Number(outcome)));
      });
      expect(events).not.toHaveBeenCalled();
      expect(detailReads).toHaveBeenCalledTimes(readsBefore);
      expect(screen.getByRole("heading", { name: "My Tickets" })).toBeVisible();
      expect(screen.getByTestId("requester-badge")).toHaveTextContent("Requester B");
      expect(view.container).not.toHaveTextContent("Private A");
      expect(window.location.pathname).toBe("/tickets");
    } finally { window.removeEventListener("session-access-changed", events); }
  });
}
