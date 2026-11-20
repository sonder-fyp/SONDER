/** Teacher review revisions of one finished check (sonder.session_review, I2-A14). */
export type ReviewStatus = "reviewed" | "follow_up_required";
export type Review = { revision: number; status: ReviewStatus; note: string; reviewer_name: string; created_at: string };
export type AddReviewRequest = { expected_revision: number; status: ReviewStatus; note: string; request_key: string };

export const REVIEW_NOTE_MAX = 2000;
const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class ReviewRequestError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function parseAddReview(body: unknown): AddReviewRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ReviewRequestError("invalid_request");
  const { expected_revision, status, note, request_key } = body as Record<string, unknown>;
  if (!Number.isInteger(expected_revision) || (expected_revision as number) < 0) throw new ReviewRequestError("invalid_request");
  if (typeof request_key !== "string" || !KEY.test(request_key)) throw new ReviewRequestError("invalid_request");
  if (status !== "reviewed" && status !== "follow_up_required") throw new ReviewRequestError("review_status_invalid");
  if (note !== undefined && typeof note !== "string") throw new ReviewRequestError("review_note_invalid");
  const text = (note ?? "").trim();
  if (text.length > REVIEW_NOTE_MAX) throw new ReviewRequestError("review_note_invalid");
  return { expected_revision: expected_revision as number, status, note: text, request_key };
}

function timestamp(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid review time.");
  return date.toISOString();
}

export function parseReview(value: unknown): Review {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (!Number.isInteger(r.revision) || (r.revision as number) < 1 || (r.status !== "reviewed" && r.status !== "follow_up_required")
    || typeof r.note !== "string" || typeof r.reviewer_name !== "string") {
    throw new Error("Invalid review.");
  }
  return { revision: r.revision as number, status: r.status, note: r.note, reviewer_name: r.reviewer_name,
    created_at: timestamp(r.created_at) };
}

export function parseReviewList(value: unknown): Review[] {
  const list = (value as { reviews?: unknown } | null)?.reviews;
  if (!Array.isArray(list)) throw new Error("Invalid reviews.");
  return list.map(parseReview);
}
