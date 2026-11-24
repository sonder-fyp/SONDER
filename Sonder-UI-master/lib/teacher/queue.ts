/** Finished checks waiting for the teacher, across all their classes (sonder.teacher_queue). */
export type QueueRow = {
  session_id: string; class_id: string; class_name: string; student_name: string;
  assignment_id: string | null; assignment_title: string | null; unit_code: string;
  ended_at: string | null; review_status: "follow_up_required" | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNIT = /^[A-Za-z0-9_-]{1,32}$/;

function time(value: unknown): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid queue time.");
  return date.toISOString();
}

export function parseQueueRow(value: unknown): QueueRow {
  const r = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const ok =
    typeof r.session_id === "string" && UUID.test(r.session_id) && typeof r.class_id === "string" && UUID.test(r.class_id) &&
    typeof r.class_name === "string" && typeof r.student_name === "string" &&
    (r.assignment_id === null ? r.assignment_title === null : typeof r.assignment_id === "string" && UUID.test(r.assignment_id) &&
      typeof r.assignment_title === "string") &&
    typeof r.unit_code === "string" && UNIT.test(r.unit_code) &&
    (r.review_status === null || r.review_status === "follow_up_required");
  if (!ok) throw new Error("Invalid queue row.");
  return {
    session_id: r.session_id as string, class_id: r.class_id as string, class_name: r.class_name as string,
    student_name: r.student_name as string, assignment_id: r.assignment_id as string | null,
    assignment_title: r.assignment_title as string | null, unit_code: r.unit_code as string, ended_at: time(r.ended_at),
    review_status: r.review_status as QueueRow["review_status"],
  };
}

export function parseQueue(value: unknown): QueueRow[] {
  const rows = (value as { rows?: unknown } | null)?.rows;
  if (!Array.isArray(rows)) throw new Error("Invalid queue.");
  return rows.map(parseQueueRow);
}

/** Newest finished first, then session id. */
export function orderedQueue(rows: QueueRow[]): QueueRow[] {
  return [...rows].sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? "") || a.session_id.localeCompare(b.session_id));
}
