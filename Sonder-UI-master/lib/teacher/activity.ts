/**
 * Teacher dashboard rows and counts (I2-A11). Every count is computed from the rows themselves, so the
 * summary and the table cannot disagree (docs/design/I2_TEACHER_STUDENT_REQUIREMENTS.md section 3).
 */

export type ActivityState = "not_started" | "in_progress" | "completed";
export type ActivityRow = {
  student_id: string;
  student_name: string;
  assignment_id: string;
  assignment_title: string;
  unit_code: string;
  attempt_rule: "single" | "repeat";
  state: ActivityState;
  session_id: string | null;
  answered: number;
  question_budget: number | null;
  attempts: number;
  last_activity: string | null;
  review_status: "reviewed" | "follow_up_required" | null;
};

export type ActivityFilter = "all" | ActivityState | "needs_review" | "follow_up";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATES: ActivityState[] = ["not_started", "in_progress", "completed"];

function time(value: unknown): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid activity time.");
  return date.toISOString();
}

export function parseActivityRow(value: unknown): ActivityRow {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const ok =
    typeof r.student_id === "string" && UUID.test(r.student_id) && typeof r.student_name === "string" &&
    typeof r.assignment_id === "string" && UUID.test(r.assignment_id) && typeof r.assignment_title === "string" &&
    typeof r.unit_code === "string" && (r.attempt_rule === "single" || r.attempt_rule === "repeat") &&
    STATES.includes(r.state as ActivityState) &&
    (r.session_id === null || (typeof r.session_id === "string" && UUID.test(r.session_id))) &&
    Number.isInteger(r.answered) && (r.question_budget === null || Number.isInteger(r.question_budget)) &&
    Number.isInteger(r.attempts) &&
    (r.review_status === null || r.review_status === "reviewed" || r.review_status === "follow_up_required");
  if (!ok) throw new Error("Invalid activity row.");
  return {
    student_id: r.student_id as string, student_name: r.student_name as string, assignment_id: r.assignment_id as string,
    assignment_title: r.assignment_title as string, unit_code: r.unit_code as string,
    attempt_rule: r.attempt_rule as ActivityRow["attempt_rule"], state: r.state as ActivityState,
    session_id: r.session_id as string | null, answered: r.answered as number, question_budget: r.question_budget as number | null,
    attempts: r.attempts as number, last_activity: time(r.last_activity), review_status: r.review_status as ActivityRow["review_status"],
  };
}

export function parseActivity(value: unknown): ActivityRow[] {
  const rows = (value as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) throw new Error("Invalid activity.");
  return rows.map(parseActivityRow);
}

/** Does a row belong under a filter? The counts use the same test, so they always match the table. */
export function matches(row: ActivityRow, filter: ActivityFilter) {
  switch (filter) {
    case "all": return true;
    case "needs_review": return row.state === "completed" && row.review_status === null;
    case "follow_up": return row.review_status === "follow_up_required";
    default: return row.state === filter;
  }
}

export const FILTERS: { value: ActivityFilter; label: string; definition: string }[] = [
  { value: "all", label: "Assigned", definition: "Each student in the class, once for each assignment shown." },
  { value: "not_started", label: "Not started", definition: "Assigned, with no attempt yet." },
  { value: "in_progress", label: "In progress", definition: "The latest attempt is unfinished." },
  { value: "completed", label: "Completed", definition: "The latest attempt is finished (any outcome)." },
  { value: "needs_review", label: "Needs review", definition: "Completed, and you have not reviewed the latest attempt." },
  { value: "follow_up", label: "Follow-up required", definition: "Your latest review of the latest attempt says follow-up is needed." },
];

export function counts(rows: ActivityRow[]): Record<ActivityFilter, number> {
  return Object.fromEntries(FILTERS.map(({ value }) => [value, rows.filter((row) => matches(row, value)).length])) as
    Record<ActivityFilter, number>;
}

/** Stable order: most recent activity first, never-started last, then name, then ids. */
export function ordered(rows: ActivityRow[]): ActivityRow[] {
  return [...rows].sort((a, b) =>
    (b.last_activity ?? "").localeCompare(a.last_activity ?? "") ||
    a.student_name.localeCompare(b.student_name) ||
    a.assignment_title.localeCompare(b.assignment_title) ||
    a.student_id.localeCompare(b.student_id) || a.assignment_id.localeCompare(b.assignment_id));
}
