import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getComments, postComment, indicateResolved, PublicComment } from "../api.js";
import FormField from "./common/FormField.js";
import { useMutationContext } from "./common/useMutationContext.js";
export default function RequesterDiscussion({ ticketId, resolvedAt, isSessionCurrent = () => true }: {
    ticketId: string;
    resolvedAt?: string | null;
    isSessionCurrent?: () => boolean;
}) {
    const [comments, setComments] = useState<PublicComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [fieldError, setFieldError] = useState("");
    const [denied, setDenied] = useState(false);
    const [content, setContent] = useState("");
    const [busy, setBusy] = useState<"comment" | "indication" | null>(null);
    const [resolved, setResolved] = useState(resolvedAt);
    const [message, setMessage] = useState("");
    const [readFailed, setReadFailed] = useState(false);
    const generation = useRef(0);
    const pending = useRef<AbortController | null>(null);
    const mutation = useRef<ReturnType<ReturnType<typeof useMutationContext>> | null>(null);
    const beginMutation = useMutationContext(ticketId, isSessionCurrent);
    const heading = useRef<HTMLHeadingElement>(null);
    const loadComments = useCallback(async () => {
        pending.current?.abort(); const controller = new AbortController(); pending.current = controller;
        const token = ++generation.current; setLoading(true); setError(""); setReadFailed(false);
        try {
            const data = await getComments(ticketId, { signal: controller.signal, isCurrent: () => token === generation.current });
            if (token === generation.current) setComments(data);
        } catch {
            if (token === generation.current) { setReadFailed(true); setError("Unable to load Public Comments."); }
        } finally { if (token === generation.current) setLoading(false); }
    }, [ticketId]);
    useEffect(() => { setComments([]); void loadComments(); return () => { pending.current?.abort(); ++generation.current; }; }, [loadComments]);
    useEffect(() => {
        if (mutation.current && !mutation.current.context.isCurrent()) {
            mutation.current.finish(); mutation.current = null; setBusy(null);
            setError("The earlier request may have completed. Refresh and review before submitting again.");
        }
    }, [isSessionCurrent]);
    const fail = (cause: unknown) => {
        if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
            setDenied(true); setComments([]); setContent(""); setMessage(""); setFieldError("");
            setError("Discussion is unavailable for your session or role.");
        } else setError(cause instanceof ApiError && cause.status < 500 ? cause.message : "The request outcome could not be confirmed. Refresh and review before submitting again.");
    };
    async function submit(event: FormEvent) { event.preventDefault(); if (mutation.current || loading || readFailed || denied || !isSessionCurrent())
        return; const text = content.trim(); if (!text || text.length > 2000) {
        setFieldError("Comment must contain 1 to 2000 characters after trimming.");
        const invalidControl = event.currentTarget.querySelector<HTMLElement>("#requester-comment");
        requestAnimationFrame(() => { if (invalidControl?.isConnected && isSessionCurrent()) invalidControl.focus(); });
        return;
    } const commentControl = event.currentTarget.querySelector<HTMLElement>("#requester-comment");
    const request = beginMutation(); mutation.current = request; setBusy("comment"); setError(""); setFieldError(""); setMessage(""); try {
        const comment = await postComment(ticketId, text, request.context);
        if (!request.context.isCurrent()) return;
        setComments(items => [...items, comment]);
        setContent("");
        setMessage("Public Comment posted.");
    }
    catch (err) {
        if (request.context.isCurrent()) {
            if (err instanceof ApiError && err.status === 400 && err.code === "VALIDATION_ERROR") {
                setFieldError(err.message);
                requestAnimationFrame(() => { if (request.context.isCurrent() && commentControl?.isConnected) commentControl.focus(); });
            } else fail(err);
        }
    }
    finally {
        request.finish(); if (request.context.isCurrent()) { mutation.current = null; setBusy(null); }
    } }
    async function resolve() { if (mutation.current || denied || !isSessionCurrent())
        return; const request = beginMutation(); mutation.current = request; setBusy("indication"); setError(""); setMessage(""); try {
        const result = await indicateResolved(ticketId, request.context);
        if (!request.context.isCurrent()) return;
        setResolved(result.problemAppearsResolvedAt);
        setMessage("Problem Appears Resolved recorded. IT Staff remains responsible for the ticket status.");
    }
    catch (err) {
        if (request.context.isCurrent()) fail(err);
    }
    finally {
        request.finish(); if (request.context.isCurrent()) { mutation.current = null; setBusy(null); }
    } }
    return <section className="zen-card p-4 my-4" aria-busy={loading || !!busy}><h2 ref={heading} tabIndex={-1} className="h5 fw-bold">Public Comments</h2>{denied ? null : loading ? <p role="status">Loading Public Comments...</p> : readFailed ? <button className="btn btn-outline-primary-green" onClick={() => { heading.current?.focus(); void loadComments(); }}>Retry Public Comments</button> : comments.length === 0 ? <p>No Public Comments yet.</p> : comments.map(comment => <article key={comment.id} className="border-bottom py-3"><strong>{comment.author.name}</strong> <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.content}</p></article>)}
 {!denied && <form onSubmit={submit} noValidate><FormField id="requester-comment" label="Comment" error={fieldError}><textarea required className="form-control" value={content} onChange={event => { setContent(event.target.value); setFieldError(""); }}/></FormField><button className="btn btn-primary-green mt-2" disabled={!!busy || loading || readFailed}>{busy === "comment" ? "Submitting Comment..." : "Submit Comment"}</button></form>}
 {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
 {!denied && <div className="mt-4">{resolved ? <p>Problem Appears Resolved recorded at {new Date(resolved).toLocaleString()}.</p> : <button className="btn btn-outline-primary-green" disabled={!!busy} onClick={resolve}>{busy === "indication" ? "Recording indication..." : "Problem Appears Resolved"}</button>}</div>}</section>;
}
