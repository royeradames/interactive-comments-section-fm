import data from "./data.json";

export const storageKey = "fm-interactive-comments-v1";
export const currentUser = data.currentUser;
type User = typeof currentUser;
export type Vote = -1 | 0 | 1;
type CreatedAt = { kind: "sample"; label: string } | { kind: "posted"; at: number };
export type Comment = {
  id: number;
  content: string;
  createdAt: CreatedAt;
  score: number;
  vote: Vote;
  user: User;
};
export type Reply = Comment & { replyingTo: string };
export type Thread = Comment & { replies: Reply[] };
export type ReplyTarget = { threadId: number; username: string };
export type AddTarget = { kind: "comment" } | ({ kind: "reply" } & ReplyTarget);
export type State = { comments: Thread[]; restored: boolean; now: number; storageNote: string };
export type Action =
  | { kind: "restore"; comments: Thread[]; now: number }
  | { kind: "reset" }
  | { kind: "tick"; now: number }
  | { kind: "storage-unavailable" }
  | { kind: "add"; content: string; target: AddTarget; now: number }
  | { kind: "update"; id: number; content: string }
  | { kind: "delete"; id: number }
  | { kind: "vote"; id: number; direction: -1 | 1 };

function sampleComment(item: (typeof data.comments)[number] | (typeof data.comments)[number]["replies"][number]): Comment {
  return { id: item.id, content: item.content, createdAt: { kind: "sample", label: item.createdAt }, score: item.score, vote: 0, user: item.user };
}

export function initialComments(): Thread[] {
  return data.comments.map((thread) => ({ ...sampleComment(thread), replies: thread.replies.map((reply) => ({ ...sampleComment(reply), replyingTo: reply.replyingTo })) }));
}

export const initialState: State = { comments: initialComments(), restored: false, now: 0, storageNote: "" };
export const displayedScore = (comment: Comment) => comment.score + comment.vote;

export function commentsReducer(state: State, action: Action): State {
  if (action.kind === "restore") return { ...state, comments: action.comments, restored: true, now: action.now };
  if (action.kind === "reset") return { ...state, comments: initialComments() };
  if (action.kind === "tick") return { ...state, now: action.now };
  if (action.kind === "storage-unavailable") return { ...state, storageNote: "Browser storage is unavailable. Changes will last until you leave or reload this page." };
  if (action.kind === "add") {
    const id = Math.max(0, ...state.comments.flatMap((thread) => [thread.id, ...thread.replies.map((reply) => reply.id)])) + 1;
    const comment: Comment = { id, content: action.content, createdAt: { kind: "posted", at: action.now }, score: 0, vote: 0, user: currentUser };
    const target = action.target;
    if (target.kind === "comment") return { ...state, comments: [...state.comments, { ...comment, replies: [] }], now: action.now };
    return { ...state, now: action.now, comments: state.comments.map((thread) => thread.id === target.threadId ? { ...thread, replies: [...thread.replies, { ...comment, replyingTo: target.username }] } : thread) };
  }
  if (action.kind === "delete") {
    return { ...state, comments: state.comments.filter((thread) => thread.id !== action.id || thread.user.username !== currentUser.username).map((thread) => ({ ...thread, replies: thread.replies.filter((reply) => reply.id !== action.id || reply.user.username !== currentUser.username) })) };
  }
  const change = <T extends Comment>(comment: T): T => {
    if (comment.id !== action.id) return comment;
    if (action.kind === "update") return comment.user.username === currentUser.username ? { ...comment, content: action.content } : comment;
    return { ...comment, vote: comment.vote === action.direction ? 0 : action.direction };
  };
  return { ...state, comments: state.comments.map((thread) => ({ ...change(thread), replies: thread.replies.map(change) })) };
}

const users: User[] = [currentUser, ...data.comments.flatMap((thread) => [thread.user, ...thread.replies.map((reply) => reply.user)])];
const sampleTimes = data.comments.flatMap((thread) => [thread.createdAt, ...thread.replies.map((reply) => reply.createdAt)]);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function parseCreatedAt(value: unknown): CreatedAt | null {
  if (!isRecord(value)) return null;
  if (value.kind === "sample" && typeof value.label === "string" && sampleTimes.includes(value.label)) return { kind: "sample", label: value.label };
  if (value.kind === "posted" && typeof value.at === "number" && Number.isSafeInteger(value.at) && value.at > 0 && value.at <= 8.64e15) return { kind: "posted", at: value.at };
  return null;
}

function parseComment(value: unknown): Comment | null {
  if (!isRecord(value) || !isRecord(value.user)) return null;
  const storedUser = value.user;
  const user = users.find((candidate) => candidate.username === storedUser.username);
  const createdAt = parseCreatedAt(value.createdAt);
  if (!user || !createdAt || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id <= 0 || value.id >= Number.MAX_SAFE_INTEGER) return null;
  if (typeof value.content !== "string" || !value.content.trim() || typeof value.score !== "number" || !Number.isSafeInteger(value.score) || Math.abs(value.score) > 1_000_000) return null;
  if (value.vote !== -1 && value.vote !== 0 && value.vote !== 1) return null;
  return { id: value.id, content: value.content, createdAt, score: value.score, vote: value.vote, user };
}

// Treat storage as untrusted JSON. Reconstruct users from FM data so stored image URLs cannot introduce network requests.
export function parseStoredComments(raw: string): Thread[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.comments)) return null;
    const comments: Thread[] = [];
    const ids = new Set<number>();
    for (const item of value.comments) {
      const comment = parseComment(item);
      if (!comment || !isRecord(item) || !Array.isArray(item.replies) || ids.has(comment.id)) return null;
      ids.add(comment.id);
      const replies: Reply[] = [];
      for (const itemReply of item.replies) {
        const reply = parseComment(itemReply);
        if (!reply || !isRecord(itemReply) || typeof itemReply.replyingTo !== "string" || !users.some((user) => user.username === itemReply.replyingTo) || ids.has(reply.id)) return null;
        ids.add(reply.id);
        replies.push({ ...reply, replyingTo: itemReply.replyingTo });
      }
      comments.push({ ...comment, replies });
    }
    return comments;
  } catch {
    return null;
  }
}

export function relativeTime(createdAt: CreatedAt, now: number): string {
  if (createdAt.kind === "sample") return createdAt.label;
  const minutes = Math.floor(Math.max(0, now - createdAt.at) / 60_000);
  if (minutes === 0) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
