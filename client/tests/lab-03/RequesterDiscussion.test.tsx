import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RequesterDiscussion from "../../src/components/RequesterDiscussion.js";
import * as api from "../../src/api.js";
const comment: api.PublicComment = { id: "comment", ticketId: "ticket", content: "<script>privateScript()</script>", author: { id: "alice", name: "Alice", role: "REQUESTER" }, createdAt: "2026-09-19T00:00:00Z" };
beforeEach(() => { vi.restoreAllMocks(); vi.spyOn(api, "getComments").mockResolvedValue([]); });
describe("Requester discussion UI-37 through UI-40", () => {
    it("permission denial clears discussion without a false empty state or writable draft", async () => {
        vi.mocked(api.getComments).mockResolvedValue([comment]); vi.spyOn(api, "postComment").mockRejectedValue(new api.ApiError("FORBIDDEN", "Not permitted.", 403));
        render(<RequesterDiscussion ticketId="ticket" />); await screen.findByText(comment.content);
        fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Reply" } }); await userEvent.click(screen.getByRole("button", { name: "Submit Comment" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("unavailable"); expect(screen.queryByText(comment.content)).not.toBeInTheDocument(); expect(screen.queryByText("No Public Comments yet.")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Comment")).not.toBeInTheDocument();
    });
    it("AX-02: server validation is linked to the retained comment and focuses it", async () => {
        vi.spyOn(api, "postComment").mockRejectedValue(new api.ApiError("VALIDATION_ERROR", "Comment cannot contain a null character.", 400));
        render(<RequesterDiscussion ticketId="ticket" />); await screen.findByText("No Public Comments yet.");
        const input = screen.getByLabelText("Comment"); fireEvent.change(input, { target: { value: "Retained server-rejected comment" } });
        await userEvent.click(screen.getByRole("button", { name: "Submit Comment" }));
        await waitFor(() => expect(input).toHaveFocus()); expect(input).toHaveAttribute("aria-invalid", "true"); expect(input).toHaveAccessibleDescription(/null character/); expect(input).toHaveValue("Retained server-rejected comment");
    });
    it("AX-02: a deferred validation focus cannot target a replacement discussion", async () => {
        let focusCallback!: FrameRequestCallback; vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(callback => { focusCallback = callback; return 1; });
        const old = render(<RequesterDiscussion ticketId="old" />); await screen.findByText("No Public Comments yet.");
        fireEvent.submit(screen.getByLabelText("Comment").closest("form")!); old.unmount();
        render(<RequesterDiscussion ticketId="new" />); await screen.findByText("No Public Comments yet.");
        const button = screen.getByRole("button", { name: "Submit Comment" }); button.focus(); act(() => focusCallback(0)); expect(button).toHaveFocus();
    });
    it("AX-02: links validation to the preserved comment and focuses it", async () => {
        render(<RequesterDiscussion ticketId="ticket" />); await screen.findByText("No Public Comments yet.");
        const input = screen.getByLabelText("Comment"); fireEvent.change(input, { target: { value: "  " } }); await userEvent.click(screen.getByRole("button", { name: "Submit Comment" }));
        await waitFor(() => expect(input).toHaveFocus()); expect(input).toHaveAttribute("aria-invalid", "true"); expect(input).toHaveAccessibleDescription(/1 to 2000/); expect(input).toHaveValue("  ");
    });
    it("cannot post before the initial comment snapshot has finished loading", async () => {
        let finishLoading!: (comments: api.PublicComment[]) => void;
        vi.mocked(api.getComments).mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; }));
        const post = vi.spyOn(api, "postComment").mockResolvedValue(comment);
        render(<RequesterDiscussion ticketId="ticket"/>);
        fireEvent.change(screen.getByLabelText("Comment"), { target: { value: comment.content } });
        expect(screen.getByRole("button", { name: "Submit Comment" })).toBeDisabled();
        fireEvent.submit(screen.getByLabelText("Comment").closest("form")!);
        expect(post).not.toHaveBeenCalled();
        await act(async () => { finishLoading([]); });
        await userEvent.click(screen.getByRole("button", { name: "Submit Comment" }));
        expect(await screen.findByText(comment.content)).toBeInTheDocument();
    });
    it("loads public author/content/time as plain text and has no staff controls", async () => { vi.mocked(api.getComments).mockResolvedValue([comment]); const { container } = render(<RequesterDiscussion ticketId="ticket"/>); expect(await screen.findByText(comment.content)).toBeInTheDocument(); expect(screen.getByText("Alice")).toBeInTheDocument(); expect(container.querySelector("script")).toBeNull(); expect(container.querySelector("time")).toHaveAttribute("datetime", comment.createdAt); expect(screen.queryByText(/Internal Notes/)).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: /^(Resolve|Close)$/ })).not.toBeInTheDocument(); });
    it("shows empty state and posts trimmed text with success feedback", async () => { const post = vi.spyOn(api, "postComment").mockResolvedValue({ ...comment, content: "Still broken" }); render(<RequesterDiscussion ticketId="ticket"/>); expect(await screen.findByText("No Public Comments yet.")).toBeInTheDocument(); await userEvent.type(screen.getByLabelText("Comment"), "  Still broken  "); await userEvent.click(screen.getByRole("button", { name: "Submit Comment" })); expect(post).toHaveBeenCalledWith("ticket", "Still broken", expect.objectContaining({ signal: expect.any(AbortSignal), isCurrent: expect.any(Function) })); expect(await screen.findByText("Public Comment posted.")).toBeInTheDocument(); expect(screen.getByLabelText("Comment")).toHaveValue(""); });
    it.each(["   ", "x".repeat(2001)])("rejects invalid trimmed comment length", async (content) => { const post = vi.spyOn(api, "postComment"); render(<RequesterDiscussion ticketId="ticket"/>); await screen.findByText("No Public Comments yet."); fireEvent.change(screen.getByLabelText("Comment"), { target: { value: content } }); await userEvent.click(screen.getByRole("button", { name: "Submit Comment" })); expect(await screen.findByRole("alert")).toHaveTextContent("1 to 2000"); expect(post).not.toHaveBeenCalled(); });
    it("records the resolution indication and disables repeat action", async () => { vi.spyOn(api, "indicateResolved").mockResolvedValue({ ticketId: "ticket", problemAppearsResolvedAt: "2026-09-19T00:00:00Z" }); render(<RequesterDiscussion ticketId="ticket"/>); await userEvent.click(screen.getByRole("button", { name: "Problem Appears Resolved" })); expect(await screen.findByText(/IT Staff remains responsible/)).toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).not.toBeInTheDocument(); });
    it("existing indication remains recorded after refresh", async () => { render(<RequesterDiscussion ticketId="ticket" resolvedAt="2026-09-19T00:00:00Z"/>);
        await screen.findByText("No Public Comments yet."); expect(screen.queryByRole("button", { name: "Problem Appears Resolved" })).not.toBeInTheDocument(); });
    it("shows safe load failures", async () => { vi.mocked(api.getComments).mockRejectedValue(new Error("database secret")); render(<RequesterDiscussion ticketId="ticket"/>); expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Public Comments."); expect(screen.queryByText("database secret")).not.toBeInTheDocument(); });
    it("handles conflict without claiming success", async () => { vi.spyOn(api, "indicateResolved").mockRejectedValue(new api.ApiError("CONFLICT", "Already recorded.", 409)); render(<RequesterDiscussion ticketId="ticket"/>); await userEvent.click(screen.getByRole("button", { name: "Problem Appears Resolved" })); expect(await screen.findByRole("alert")).toHaveTextContent("Already recorded."); });
});
