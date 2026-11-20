import "server-only";
import { database } from "@/lib/auth/database";
import { errorResponse } from "@/lib/auth/guard";
import { BoundaryError, engine } from "@/lib/diagnostic/server";
import {
  parseRosterStudent, parseStudentAssignment, parseStudentClass, parseTeacherAssignment, parseTeacherClass, UUID,
} from "./validation";
import type {
  AssignmentStatus, ClassStatus, CreateAssignmentRequest, CreateClassRequest, RosterStudent, StudentAssignment,
  StudentClass, TeacherAssignment, TeacherClass,
} from "./types";

/**
 * Codes raised by the class/assignment database functions (SQLSTATE SN001, see
 * db/migrations/0003_classes.sql and later) and the HTTP status each one maps to.
 */
const PRODUCT_ERROR_STATUS: Record<string, number> = {
  teacher_required: 403,
  student_required: 403,
  class_name_invalid: 422,
  class_note_invalid: 422,
  class_status_invalid: 422,
  join_code_invalid: 422,
  assignment_title_invalid: 422,
  attempt_rule_invalid: 422,
  assignment_status_invalid: 422,
  unit_not_found: 422,
  class_archived: 409,
  class_not_found: 404,
  student_not_found: 404,
  assignment_not_found: 404,
  session_not_found: 404,
  review_conflict: 409,
  session_unfinished: 409,
  review_status_invalid: 422,
  review_note_invalid: 422,
  invalid_request: 422,
  subject_missing: 503,
  join_code_unavailable: 503,
};

export function productErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "SN001" && typeof message === "string" ? message : null;
}

/**
 * A known product error, or a diagnostic-service boundary error, becomes its response; anything
 * else is rethrown for withAccess to report as 503.
 */
export function productErrorResponse(error: unknown) {
  if (error instanceof BoundaryError) return errorResponse(error.code, error.status);
  const code = productErrorCode(error);
  const status = code ? PRODUCT_ERROR_STATUS[code] : undefined;
  if (code && status) return errorResponse(code, status);
  throw error;
}

export async function listTeacherClasses(teacherId: string): Promise<TeacherClass[]> {
  const rows = await database()`
    SELECT class_id::text, name, note, join_code, grade_level, status, student_count, created_at
    FROM sonder.teacher_classes(${teacherId}::uuid)
    ORDER BY created_at DESC, class_id
  `;
  return rows.map(parseTeacherClass);
}

/** The class only if this teacher actively teaches it; null otherwise (reported as not found). */
export async function getTeacherClass(teacherId: string, classId: string): Promise<TeacherClass | null> {
  if (!UUID.test(classId)) return null;
  const rows = await database()`
    SELECT class_id::text, name, note, join_code, grade_level, status, student_count, created_at
    FROM sonder.teacher_classes(${teacherId}::uuid)
    WHERE class_id = ${classId}::uuid
  `;
  return rows[0] ? parseTeacherClass(rows[0]) : null;
}

export async function createClass(teacherId: string, request: CreateClassRequest): Promise<string> {
  const rows = await database()`
    SELECT class_id::text FROM sonder.create_class(${teacherId}::uuid, ${request.name}, ${request.note})
  `;
  const classId = rows[0]?.class_id;
  if (typeof classId !== "string" || !UUID.test(classId)) throw new Error("Class creation returned no id.");
  return classId;
}

/** Join (or rejoin) by code; joined is false when the student was already an active member. */
export async function joinClass(studentId: string, code: string): Promise<{ classId: string; joined: boolean }> {
  const rows = await database()`
    SELECT class_id::text, joined FROM sonder.join_class(${studentId}::uuid, ${code})
  `;
  const row = rows[0];
  if (!row || typeof row.class_id !== "string" || typeof row.joined !== "boolean") throw new Error("Join returned no class.");
  return { classId: row.class_id, joined: row.joined };
}

export async function listStudentClasses(studentId: string): Promise<StudentClass[]> {
  const rows = await database()`
    SELECT class_id::text, name, grade_level, teacher_names, joined_at
    FROM sonder.student_classes(${studentId}::uuid)
    ORDER BY joined_at DESC, class_id
  `;
  return rows.map(parseStudentClass);
}

/** Active students of a class the teacher teaches (callers check the class first). */
export async function classRoster(teacherId: string, classId: string): Promise<RosterStudent[]> {
  const rows = await database()`
    SELECT student_id::text, display_name, joined_at
    FROM sonder.class_roster(${teacherId}::uuid, ${classId}::uuid)
    ORDER BY lower(display_name), joined_at, student_id
  `;
  return rows.map(parseRosterStudent);
}

export async function removeStudent(teacherId: string, classId: string, studentId: string) {
  await database()`SELECT sonder.remove_student(${teacherId}::uuid, ${classId}::uuid, ${studentId}::uuid)`;
}

export async function regenerateJoinCode(teacherId: string, classId: string) {
  await database()`SELECT sonder.regenerate_join_code(${teacherId}::uuid, ${classId}::uuid)`;
}

export async function setClassStatus(teacherId: string, classId: string, status: ClassStatus) {
  await database()`SELECT sonder.set_class_status(${teacherId}::uuid, ${classId}::uuid, ${status})`;
}

/**
 * The content version the diagnostic service is running, from its own health report (release label
 * "<version_code>/<model_code>"). Assignments are pinned to units of this version, so students can start them.
 */
export async function runningContentVersion(): Promise<string> {
  return engine("/engine/health", (value) => {
    const release = (value as { release?: unknown } | null)?.release;
    const [version, model] = typeof release === "string" ? release.split("/") : [];
    if (!version || !model) throw new BoundaryError(503, "assignments_unavailable");
    return version;
  });
}

export async function listClassAssignments(teacherId: string, classId: string): Promise<TeacherAssignment[]> {
  const rows = await database()`
    SELECT assignment_id::text, class_id::text, title, unit_code, unit_name, version_code, status, attempt_rule, created_at
    FROM sonder.class_assignments(${teacherId}::uuid, ${classId}::uuid)
    ORDER BY created_at DESC, assignment_id
  `;
  return rows.map(parseTeacherAssignment);
}

export async function createAssignment(teacherId: string, classId: string, versionCode: string,
  request: CreateAssignmentRequest): Promise<string> {
  const rows = await database()`
    SELECT sonder.create_assignment(${teacherId}::uuid, ${classId}::uuid, ${versionCode}, ${request.unit_id},
                                    ${request.title}, ${request.attempt_rule})::text AS assignment_id
  `;
  const id = rows[0]?.assignment_id;
  if (typeof id !== "string" || !UUID.test(id)) throw new Error("Assignment creation returned no id.");
  return id;
}

export async function setAssignmentStatus(teacherId: string, assignmentId: string, status: AssignmentStatus) {
  await database()`SELECT sonder.set_assignment_status(${teacherId}::uuid, ${assignmentId}::uuid, ${status})`;
}

export async function listStudentAssignments(studentId: string): Promise<StudentAssignment[]> {
  const rows = await database()`
    SELECT assignment_id::text, class_id::text, class_name, title, unit_code, unit_name, attempt_rule, created_at
    FROM sonder.student_assignments(${studentId}::uuid)
    ORDER BY created_at DESC, assignment_id
  `;
  return rows.map(parseStudentAssignment);
}
