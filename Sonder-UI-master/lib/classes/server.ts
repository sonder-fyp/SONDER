import "server-only";
import { database } from "@/lib/auth/database";
import { errorResponse } from "@/lib/auth/guard";
import { parseTeacherClass, UUID } from "./validation";
import type { CreateClassRequest, TeacherClass } from "./types";

/**
 * Codes raised by the class/assignment database functions (SQLSTATE SN001, see
 * db/migrations/0003_classes.sql) and the HTTP status each one maps to.
 */
const PRODUCT_ERROR_STATUS: Record<string, number> = {
  teacher_required: 403,
  class_name_invalid: 422,
  class_note_invalid: 422,
  subject_missing: 503,
  join_code_unavailable: 503,
};

export function productErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return code === "SN001" && typeof message === "string" ? message : null;
}

/** A known product error becomes its response; anything else is rethrown for withAccess to report as 503. */
export function productErrorResponse(error: unknown) {
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
