import "server-only";
import { database } from "@/lib/auth/database";
import { parseCard, type StudentAssignmentCard } from "./dashboard";
import { parseHistoryEntry, type HistoryEntry } from "./history";

export async function studentDashboard(studentId: string): Promise<StudentAssignmentCard[]> {
  const rows = await database()`
    SELECT assignment_id::text, class_id::text, class_name, title, unit_code, unit_name, attempt_rule, created_at,
           latest_session_id::text, latest_state, answered, question_budget, attempts
    FROM sonder.student_dashboard(${studentId}::uuid)
    ORDER BY created_at DESC, assignment_id
  `;
  return rows.map(parseCard);
}

export async function studentHistory(studentId: string): Promise<HistoryEntry[]> {
  const rows = await database()`
    SELECT session_id::text, unit_code, unit_name, class_name, assignment_id::text, assignment_title, attempt_number,
           started_at, ended_at, state, answered, question_budget
    FROM sonder.student_history(${studentId}::uuid)
    ORDER BY started_at DESC, session_id
  `;
  return rows.map(parseHistoryEntry);
}

