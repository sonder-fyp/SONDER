/** A class's checks started without an assignment, before assignments were required (sonder.class_other_checks). */
export type OtherCheck = {
  session_id: string; student_name: string; unit_code: string; unit_name: string;
  state: "in_progress" | "completed"; answered: number; question_budget: number | null;
  started_at: string; ended_at: string | null; review_status: "reviewed" | "follow_up_required" | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function time(value: unknown): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid check time.");
  return date.toISOString();
}

export function parseOtherCheck(value: unknown): OtherCheck {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const ok =
    typeof r.session_id === "string" && UUID.test(r.session_id) && typeof r.student_name === "string" &&
    typeof r.unit_code === "string" && typeof r.unit_name === "string" &&
    (r.state === "in_progress" || r.state === "completed") && Number.isInteger(r.answered) &&
    (r.question_budget === null || Number.isInteger(r.question_budget)) && r.started_at !== null &&
    (r.review_status === null || r.review_status === "reviewed" || r.review_status === "follow_up_required");
  if (!ok) throw new Error("Invalid other check.");
  return {
    session_id: r.session_id as string, student_name: r.student_name as string, unit_code: r.unit_code as string,
    unit_name: r.unit_name as string, state: r.state as OtherCheck["state"], answered: r.answered as number,
    question_budget: r.question_budget as number | null, started_at: time(r.started_at) as string, ended_at: time(r.ended_at),
    review_status: r.review_status as OtherCheck["review_status"],
  };
}

export function parseOtherChecks(value: unknown): OtherCheck[] {
  const checks = (value as { checks?: unknown } | null)?.checks;
  if (!Array.isArray(checks)) throw new Error("Invalid other checks.");
  return checks.map(parseOtherCheck);
}
