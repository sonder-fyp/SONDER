/** A student's open assignments with their own latest attempt, and the one action each allows (I2-A16, I2-A17). */

export type StudentAssignmentCard = {
  assignment_id: string;
  class_id: string;
  class_name: string;
  title: string;
  unit_code: string;
  unit_name: string;
  attempt_rule: "single" | "repeat";
  created_at: string;
  latest_session_id: string | null;
  latest_state: "in_progress" | "submitted" | null;
  answered: number;
  question_budget: number | null;
  attempts: number;
};

export type CardAction =
  | { kind: "start"; label: string; href: string }
  | { kind: "resume"; label: string; href: string }
  | { kind: "done"; label: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNIT = /^[A-Za-z0-9_-]{1,32}$/;
const ALLOWED = ["assignment_id", "class_id", "class_name", "title", "unit_code", "unit_name", "attempt_rule", "created_at",
  "latest_session_id", "latest_state", "answered", "question_budget", "attempts"] as const;

function time(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid time.");
  return date.toISOString();
}

/** Rebuilt from the allowed fields only, so nothing else can reach student JSON. */
export function parseCard(value: unknown): StudentAssignmentCard {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const ok =
    typeof r.assignment_id === "string" && UUID.test(r.assignment_id) && typeof r.class_id === "string" && UUID.test(r.class_id) &&
    typeof r.class_name === "string" && typeof r.title === "string" && typeof r.unit_code === "string" && UNIT.test(r.unit_code) &&
    typeof r.unit_name === "string" && (r.attempt_rule === "single" || r.attempt_rule === "repeat") &&
    (r.latest_session_id === null || (typeof r.latest_session_id === "string" && UUID.test(r.latest_session_id))) &&
    (r.latest_state === null || r.latest_state === "in_progress" || r.latest_state === "submitted") &&
    Number.isInteger(r.answered) && (r.question_budget === null || Number.isInteger(r.question_budget)) && Number.isInteger(r.attempts);
  if (!ok) throw new Error("Invalid assignment card.");
  const card = Object.fromEntries(ALLOWED.map((key) => [key, r[key]])) as StudentAssignmentCard;
  card.created_at = time(r.created_at);
  return card;
}

export function parseDashboard(value: unknown): StudentAssignmentCard[] {
  const list = (value as { assignments?: unknown } | null)?.assignments;
  if (!Array.isArray(list)) throw new Error("Invalid dashboard.");
  return list.map(parseCard);
}

/**
 * Start: no attempt yet, or a repeat assignment whose last attempt is submitted.
 * Resume: an attempt is in progress (opens that session; never creates a new one).
 * Done: a single-attempt assignment already attempted.
 */
export function actionFor(card: StudentAssignmentCard): CardAction {
  const unit = encodeURIComponent(card.unit_code);
  const assignment = encodeURIComponent(card.assignment_id);
  if (card.latest_state === "in_progress" && card.latest_session_id) {
    return { kind: "resume", label: "Resume",
      href: `/student/diagnostic/${unit}?session=${encodeURIComponent(card.latest_session_id)}&assignment=${assignment}` };
  }
  if (card.latest_state === "submitted" && card.attempt_rule === "single") return { kind: "done", label: "Done" };
  return { kind: "start", label: card.latest_state === "submitted" ? "Start again" : "Start",
    href: `/student/diagnostic/${unit}?assignment=${assignment}` };
}
