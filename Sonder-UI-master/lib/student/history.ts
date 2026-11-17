/** A student's own checks (sonder.student_history, I2-A18). Student-safe fields only. */
export type HistoryEntry = {
  session_id: string;
  unit_code: string;
  unit_name: string;
  class_name: string;
  assignment_id: string | null;
  assignment_title: string | null;
  attempt_number: number | null;
  started_at: string;
  ended_at: string | null;
  state: "in_progress" | "submitted";
  answered: number;
  question_budget: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNIT = /^[A-Za-z0-9_-]{1,32}$/;

function time(value: unknown): string {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid time.");
  return date.toISOString();
}

export function parseHistoryEntry(value: unknown): HistoryEntry {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const linked = r.assignment_id !== null;
  const ok =
    typeof r.session_id === "string" && UUID.test(r.session_id) && typeof r.unit_code === "string" && UNIT.test(r.unit_code) &&
    typeof r.unit_name === "string" && typeof r.class_name === "string" &&
    (linked ? typeof r.assignment_id === "string" && UUID.test(r.assignment_id) && typeof r.assignment_title === "string" &&
      Number.isInteger(r.attempt_number) : r.assignment_title === null && r.attempt_number === null) &&
    (r.state === "in_progress" || r.state === "submitted") && Number.isInteger(r.answered) && Number.isInteger(r.question_budget);
  if (!ok) throw new Error("Invalid history entry.");
  return {
    session_id: r.session_id as string, unit_code: r.unit_code as string, unit_name: r.unit_name as string,
    class_name: r.class_name as string, assignment_id: r.assignment_id as string | null,
    assignment_title: r.assignment_title as string | null, attempt_number: r.attempt_number as number | null,
    started_at: time(r.started_at), ended_at: r.ended_at === null ? null : time(r.ended_at),
    state: r.state as HistoryEntry["state"], answered: r.answered as number, question_budget: r.question_budget as number,
  };
}

export function parseHistory(value: unknown): HistoryEntry[] {
  const list = (value as { history?: unknown } | null)?.history;
  if (!Array.isArray(list)) throw new Error("Invalid history.");
  return list.map(parseHistoryEntry);
}

/** The resume link of an unfinished check: that exact session, with its assignment if it has one. */
export function resumeHref(entry: HistoryEntry): string | null {
  if (entry.state !== "in_progress") return null;
  const query = new URLSearchParams({ session: entry.session_id });
  if (entry.assignment_id) query.set("assignment", entry.assignment_id);
  return `/student/diagnostic/${encodeURIComponent(entry.unit_code)}?${query.toString()}`;
}
