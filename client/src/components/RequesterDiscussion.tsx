import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getComments, postComment, indicateResolved, PublicComment } from "../api.js";
export default function RequesterDiscussion({ ticketId, resolvedAt }: {
    ticketId: string;
    resolvedAt?: string | null;
}) {
    const [comments, setComments] = useState<PublicComment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [content, setContent] = useState("");
    const [busy, setBusy] = useState(false);
    const [resolved, setResolved] = useState(resolvedAt);
    const [message, setMessage] = useState("");
    const [readFailed, setReadFailed] = useState(false);
    const generation = useRef(0);
    const pending = useRef<AbortController | null>(null);
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
    async function submit(event: FormEvent) { event.preventDefault(); if (busy || loading || readFailed)
        return; const text = content.trim(); if (!text || text.length > 2000) {
        setError("Comment must contain 1 to 2000 characters after trimming.");
        return;
    } setBusy(true); setError(""); try {
        const comment = await postComment(ticketId, text);
        setComments(items => [...items, comment]);
        setContent("");
        setMessage("Public Comment posted.");
    }
    catch (err) {
        setError(err instanceof Error ? err.message : "Unable to post comment.");
    }
    finally {
        setBusy(false);
    } }
    async function resolve() { if (busy)
        return; setBusy(true); setError(""); try {
        const result = await indicateResolved(ticketId);
        setResolved(result.problemAppearsResolvedAt);
        setMessage("Problem Appears Resolved recorded. IT Staff remains responsible for the ticket status.");
    }
    catch (err) {
        setError(err instanceof Error ? err.message : "Unable to record indication.");
    }
    finally {
        setBusy(false);
    } }
    return <section className="zen-card p-4 my-4"><h2>Public Comments</h2>{loading ? <p role="status">Loading Public Comments...</p> : readFailed ? <button className="btn btn-outline-primary-green" onClick={() => void loadComments()}>Retry Public Comments</button> : comments.length === 0 ? <p>No Public Comments yet.</p> : comments.map(comment => <article key={comment.id} className="border-bottom py-3"><strong>{comment.author.name}</strong> <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString()}</time><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{comment.content}</p></article>)}
 <form onSubmit={submit}><label className="d-block">Comment<textarea className="form-control" value={content} onChange={event => setContent(event.target.value)}/></label><button className="btn btn-primary-green mt-2" disabled={busy || loading || readFailed}>Submit Comment</button></form>
 {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
 <div className="mt-4">{resolved ? <p>Problem Appears Resolved recorded at {new Date(resolved).toLocaleString()}.</p> : <button className="btn btn-outline-primary-green" disabled={busy} onClick={resolve}>Problem Appears Resolved</button>}</div></section>;
}
