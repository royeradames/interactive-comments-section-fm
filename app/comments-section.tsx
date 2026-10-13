"use client";

import { useEffect, useId, useReducer, useRef, useState, type Dispatch, type FormEvent } from "react";
import { PlusIcon, MinusIcon, ReplyIcon, EditIcon, DeleteIcon } from "./icons";
import {
  commentsReducer, currentUser, displayedScore, initialComments, initialState, parseStoredComments,
  relativeTime, storageKey, type Action, type AddTarget, type Comment, type Reply,
} from "./comments-state";

function Avatar({ user, composer = false }: { user: Comment["user"]; composer?: boolean }) {
  // FM supplies both formats; all displayed avatars use the bundled WebP files.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={composer ? "composer-avatar" : "comment-avatar"} src={user.image.webp.replace(/^\.\//, "/")} alt="" width={composer ? 40 : 32} height={composer ? 40 : 32} />;
}

type FormMode = { kind: "add"; target: AddTarget } | { kind: "edit"; comment: Comment | Reply };

function CommentForm({ mode, onSave }: { mode: FormMode; onSave: (content: string) => void }) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const replyingTo = mode.kind === "edit" ? ("replyingTo" in mode.comment ? mode.comment.replyingTo : "") : (mode.target.kind === "reply" ? mode.target.username : "");
  const initialDraft = `${replyingTo ? `@${replyingTo} ` : ""}${mode.kind === "edit" ? mode.comment.content : ""}`;
  const [draft, setDraft] = useState(initialDraft);
  const [error, setError] = useState("");
  const isEdit = mode.kind === "edit";
  const shouldFocus = isEdit || Boolean(replyingTo);
  const label = isEdit ? "Edit your comment" : replyingTo ? `Reply to ${replyingTo}` : "Add a comment";
  const button = isEdit ? "Update" : replyingTo ? "Reply" : "Send";

  useEffect(() => {
    if (!shouldFocus) return;
    textarea.current?.focus();
    textarea.current?.setSelectionRange(initialDraft.length, initialDraft.length);
  }, [shouldFocus, initialDraft]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let content = draft.trim();
    const prefix = `@${replyingTo}`;
    if (replyingTo && (content === prefix || content.startsWith(`${prefix} `) || content.startsWith(`${prefix},`))) content = content.slice(prefix.length).replace(/^,?\s*/, "").trim();
    if (!content) {
      setError("Enter a comment before submitting.");
      textarea.current?.focus();
      return;
    }
    onSave(content);
    setDraft(replyingTo ? `${prefix} ` : "");
    setError("");
    if (!shouldFocus) textarea.current?.focus();
  }

  return (
    <form className={isEdit ? "edit-form" : "comment-form"} aria-label={label} onSubmit={submit}>
      {!isEdit && <Avatar user={currentUser} composer />}
      <div className="field">
        <label className="sr-only" htmlFor={`${id}-text`}>{label}</label>
        <textarea
          id={`${id}-text`} ref={textarea} placeholder="Add a comment..." value={draft}
          onChange={(event) => { setDraft(event.target.value); if (error) setError(""); }}
          aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
          rows={isEdit ? 4 : 3}
        />
        {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
      </div>
      <button className="primary-button" type="submit" aria-label={`${button} ${isEdit ? "your comment" : replyingTo ? `to ${replyingTo}` : "your comment"}`}>{button}</button>
    </form>
  );
}

type CardProps = {
  comment: Comment | Reply;
  threadId: number;
  now: number;
  dispatch: Dispatch<Action>;
  announce: (message: string) => void;
  requestDelete: (id: number, trigger: HTMLButtonElement) => void;
};

function CommentCard({ comment, threadId, now, dispatch, announce, requestDelete }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const replyButton = useRef<HTMLButtonElement>(null);
  const own = comment.user.username === currentUser.username;
  const score = displayedScore(comment);
  const replyingTo = "replyingTo" in comment ? comment.replyingTo : "";

  function vote(direction: -1 | 1) {
    const nextVote = comment.vote === direction ? 0 : direction;
    dispatch({ kind: "vote", id: comment.id, direction });
    const change = nextVote === 0 ? "Vote removed" : nextVote === 1 ? "Upvoted" : "Downvoted";
    announce(`${change} comment by ${comment.user.username}. Score ${comment.score + nextVote}.`);
  }

  return (
    <>
      <article className="comment-card" data-comment={comment.id} aria-label={`Comment by ${comment.user.username}`}>
        <div className="score-control" role="group" aria-label={`Vote on comment by ${comment.user.username}`}>
          <button type="button" onClick={() => vote(1)} aria-label={`Upvote comment by ${comment.user.username}`} aria-pressed={comment.vote === 1}><PlusIcon /></button>
          <span className="comment-score" aria-label={`Score ${score}`}>{score}</span>
          <button type="button" onClick={() => vote(-1)} aria-label={`Downvote comment by ${comment.user.username}`} aria-pressed={comment.vote === -1}><MinusIcon /></button>
        </div>
        <header className="comment-header">
          <Avatar user={comment.user} />
          <span className="comment-username">{comment.user.username}</span>
          {own && <span className="you-tag">you</span>}
          <span className="comment-time">{relativeTime(comment.createdAt, now)}</span>
        </header>
        <div className="comment-actions">
          {own ? <>
            <button className="delete-action" type="button" aria-label="Delete your comment" onClick={(event) => requestDelete(comment.id, event.currentTarget)}><DeleteIcon />Delete</button>
            <button ref={editButton} type="button" aria-label="Edit your comment" aria-expanded={editing} onClick={() => setEditing(!editing)}><EditIcon />Edit</button>
          </> : <button ref={replyButton} type="button" aria-label={`Reply to ${comment.user.username}`} aria-expanded={replying} onClick={() => setReplying(!replying)}><ReplyIcon />Reply</button>}
        </div>
        <div className="comment-body">
          {editing ? <CommentForm mode={{ kind: "edit", comment }} onSave={(content) => {
            dispatch({ kind: "update", id: comment.id, content });
            setEditing(false);
            announce("Your comment was updated in this demo.");
            editButton.current?.focus();
          }} /> : <p className="comment-text">{replyingTo && <><strong className="reply-tag">@{replyingTo}</strong>{" "}</>}<span className="comment-content">{comment.content}</span></p>}
        </div>
      </article>
      {replying && <CommentForm mode={{ kind: "add", target: { kind: "reply", threadId, username: comment.user.username } }} onSave={(content) => {
        dispatch({ kind: "add", content, target: { kind: "reply", threadId, username: comment.user.username }, now: Date.now() });
        setReplying(false);
        announce(`Your reply to ${comment.user.username} was added to this demo.`);
        replyButton.current?.focus();
      }} />}
    </>
  );
}

export function CommentsSection() {
  const [state, dispatch] = useReducer(commentsReducer, initialState);
  const [announcement, setAnnouncement] = useState({ message: "", sequence: 0 });
  const [resetCount, setResetCount] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const pendingDelete = useRef<{ id: number; trigger: HTMLButtonElement } | null>(null);

  useEffect(() => {
    let comments = initialComments();
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) comments = parseStoredComments(raw) ?? comments;
    } catch {
      dispatch({ kind: "storage-unavailable" });
    }
    dispatch({ kind: "restore", comments, now: Date.now() });
    const interval = window.setInterval(() => dispatch({ kind: "tick", now: Date.now() }), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    // Wait for restoration so the server's sample state cannot overwrite saved comments.
    if (!state.restored) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, comments: state.comments }));
    } catch {
      dispatch({ kind: "storage-unavailable" });
    }
  }, [state.comments, state.restored]);

  function announce(message: string) {
    setAnnouncement((previous) => ({ message, sequence: previous.sequence + 1 }));
  }

  function requestDelete(id: number, trigger: HTMLButtonElement) {
    pendingDelete.current = { id, trigger };
    dialog.current?.showModal();
    cancelButton.current?.focus();
  }

  function returnFocus() {
    const trigger = pendingDelete.current?.trigger;
    pendingDelete.current = null;
    if (trigger?.isConnected) trigger.focus();
    else main.current?.querySelector<HTMLTextAreaElement>('.new-comment-form textarea')?.focus();
  }

  function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ kind: "reset" });
    setResetCount((previous) => previous + 1);
    announce("The demo was reset to Frontend Mentor's sample comments.");
  }

  return (
    <>
      <main className="comments-section" ref={main} data-restored={state.restored}>
        <h1 className="sr-only">Interactive comments section</h1>
        <ul className="comments-list" aria-label="Comments" key={resetCount}>
          {[...state.comments].sort((a, b) => displayedScore(b) - displayedScore(a) || a.id - b.id).map((thread) => (
            <li className="comment-thread" data-thread={thread.id} key={thread.id}>
              <CommentCard comment={thread} threadId={thread.id} now={state.now} dispatch={dispatch} announce={announce} requestDelete={requestDelete} />
              {thread.replies.length > 0 && <ul className="replies-list" aria-label={`Replies to ${thread.user.username}`}>
                {thread.replies.map((reply) => <li key={reply.id}><CommentCard comment={reply} threadId={thread.id} now={state.now} dispatch={dispatch} announce={announce} requestDelete={requestDelete} /></li>)}
              </ul>}
            </li>
          ))}
        </ul>
        <div className="new-comment-form" key={`composer-${resetCount}`}>
          <CommentForm mode={{ kind: "add", target: { kind: "comment" } }} onSave={(content) => {
            dispatch({ kind: "add", content, target: { kind: "comment" }, now: Date.now() });
            announce("Your comment was added to this demo.");
          }} />
        </div>
        {state.storageNote && <p className="storage-note" role="status">{state.storageNote}</p>}
        <div className="sr-only comment-announcement" role="status" aria-live="polite" aria-atomic="true">
          {announcement.message && <span key={announcement.sequence}>{announcement.message} Action {announcement.sequence}.</span>}
        </div>
      </main>
      <form id="reset-demo" onSubmit={reset} />
      <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onClose={returnFocus}>
        <h2 id="delete-title">Delete comment</h2>
        <p id="delete-description">Are you sure you want to delete this comment? This will remove the comment and can&apos;t be undone.</p>
        <div className="dialog-actions">
          <button ref={cancelButton} className="primary-button cancel-button" type="button" onClick={() => dialog.current?.close()}>No, cancel</button>
          <button className="primary-button confirm-button" type="button" onClick={() => {
            if (!pendingDelete.current) return;
            dispatch({ kind: "delete", id: pendingDelete.current.id });
            announce("Your comment was deleted from this demo.");
            dialog.current?.close();
          }}>Yes, delete</button>
        </div>
      </dialog>
    </>
  );
}
