import "server-only";
import { database } from "@/lib/auth/database";
import { parseActivityRow, type ActivityRow } from "./activity";
import { parseReview } from "./reviews";
import type { AddReviewRequest, Review } from "./reviews";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** True only if the session exists and the teacher actively teaches its class. */
export async function teacherCanSee(teacherId: string, sessionId: string): Promise<boolean> {
  if (!UUID.test(sessionId)) return false;
  const rows = await database()`
    SELECT 1 FROM sonder.diagnostic_session s JOIN sonder.enrolment e ON e.id = s.enrolment_id
    WHERE s.id = ${sessionId}::uuid AND sonder.is_class_teacher(${teacherId}::uuid, e.class_id)
  `;
  return rows.length === 1;
}

export async function listReviews(teacherId: string, sessionId: string): Promise<Review[]> {
  const rows = await database()`
    SELECT revision, status, note, reviewer_name, created_at
    FROM sonder.session_reviews(${teacherId}::uuid, ${sessionId}::uuid)
  `;
  return rows.map(parseReview);
}

export async function addReview(teacherId: string, sessionId: string, input: AddReviewRequest): Promise<number> {
  const rows = await database()`
    SELECT sonder.add_session_review(${teacherId}::uuid, ${sessionId}::uuid, ${input.expected_revision}::integer,
                                     ${input.status}, ${input.note}, ${input.request_key}) AS revision
  `;
  const revision = rows[0]?.revision;
  if (!Number.isInteger(revision)) throw new Error("Review write returned no revision.");
  return revision as number;
}

/** Dashboard rows of one class (sonder.class_activity); callers check the class is the teacher's first. */
export async function classActivity(teacherId: string, classId: string, assignmentId: string | null): Promise<ActivityRow[]> {
  const rows = await database()`
    SELECT student_id::text, student_name, assignment_id::text, assignment_title, unit_code, attempt_rule, state,
           session_id::text, answered, question_budget, attempts, last_activity, review_status
    FROM sonder.class_activity(${teacherId}::uuid, ${classId}::uuid, ${assignmentId}::uuid)
  `;
  return rows.map(parseActivityRow);
}

