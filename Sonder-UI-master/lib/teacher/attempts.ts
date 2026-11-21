/** Every attempt of one student at one assignment, for the teacher (sonder.session_attempts). */
export type Attempt = {
  session_id: string; attempt_number: number; state: "in_progress" | "completed"; answered: number;
  question_budget: number | null; started_at: string; ended_at: string | null;
  review_status: "reviewed" | "follow_up_required" | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function time(value: unknown): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid attempt time.");
  return date.toISOString();
}

export function parseAttempt(value: unknown): Attempt {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const ok =
    typeof r.session_id === "string" && UUID.test(r.session_id) && Number.isInteger(r.attempt_number) &&
    (r.attempt_number as number) > 0 && (r.state === "in_progress" || r.state === "completed") &&
    Number.isInteger(r.answered) && (r.question_budget === null || Number.isInteger(r.question_budget)) &&
    r.started_at !== null &&
    (r.review_status === null || r.review_status === "reviewed" || r.review_status === "follow_up_required");
  if (!ok) throw new Error("Invalid attempt.");
  return {
    session_id: r.session_id as string, attempt_number: r.attempt_number as number, state: r.state as Attempt["state"],
    answered: r.answered as number, question_budget: r.question_budget as number | null,
    started_at: time(r.started_at) as string, ended_at: time(r.ended_at), review_status: r.review_status as Attempt["review_status"],
  };
}

export function parseAttempts(value: unknown): Attempt[] {
  const attempts = (value as { attempts?: unknown } | null)?.attempts;
  if (!Array.isArray(attempts)) throw new Error("Invalid attempts.");
  return attempts.map(parseAttempt);
}
