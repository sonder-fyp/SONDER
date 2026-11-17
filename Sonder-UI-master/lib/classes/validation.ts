import type { ClassStatus, CreateClassRequest, RosterStudent, StudentClass, TeacherClass } from "./types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CLASS_NAME_MAX = 80;
export const CLASS_NOTE_MAX = 500;

export class ClassRequestError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Validate a create-class body. The database applies the same limits; this gives the typed error first. */
export function parseCreateClass(body: unknown): CreateClassRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClassRequestError("invalid_request");
  const { name, note } = body as Record<string, unknown>;
  if (typeof name !== "string") throw new ClassRequestError("class_name_invalid");
  if (note !== undefined && typeof note !== "string") throw new ClassRequestError("class_note_invalid");
  const trimmedName = name.trim();
  const trimmedNote = (note ?? "").trim();
  if (!trimmedName || trimmedName.length > CLASS_NAME_MAX) throw new ClassRequestError("class_name_invalid");
  if (trimmedNote.length > CLASS_NOTE_MAX) throw new ClassRequestError("class_note_invalid");
  return { name: trimmedName, note: trimmedNote };
}

/** A join body: the code as typed. The database ignores case, spaces and hyphens. */
export function parseJoinRequest(body: unknown): string {
  const code = (body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).code : undefined);
  if (typeof code !== "string" || !code.trim() || code.length > 64) throw new ClassRequestError("join_code_invalid");
  return code;
}

export function parseStatusRequest(body: unknown): ClassStatus {
  const status = (body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).status : undefined);
  if (status !== "active" && status !== "archived") throw new ClassRequestError("class_status_invalid");
  return status;
}

function timestamp(value: unknown) {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw new Error("Invalid class timestamp.");
  return date.toISOString();
}

/** Check one row (database or API response) field by field. */
export function parseTeacherClass(value: unknown): TeacherClass {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (
    typeof row.class_id !== "string" || !UUID.test(row.class_id) ||
    typeof row.name !== "string" || typeof row.note !== "string" ||
    typeof row.join_code !== "string" || row.join_code.length < 8 ||
    typeof row.grade_level !== "number" || !Number.isInteger(row.grade_level) ||
    (row.status !== "active" && row.status !== "archived") ||
    typeof row.student_count !== "number" || !Number.isInteger(row.student_count) || row.student_count < 0
  ) {
    throw new Error("Invalid class.");
  }
  return {
    class_id: row.class_id,
    name: row.name,
    note: row.note,
    join_code: row.join_code,
    grade_level: row.grade_level,
    status: row.status,
    student_count: row.student_count,
    created_at: timestamp(row.created_at),
  };
}

export function parseTeacherClassList(value: unknown): TeacherClass[] {
  const classes = (value as { classes?: unknown } | null)?.classes;
  if (!Array.isArray(classes)) throw new Error("Invalid class list.");
  return classes.map(parseTeacherClass);
}

export function parseTeacherClassResponse(value: unknown): TeacherClass {
  return parseTeacherClass((value as { class?: unknown } | null)?.class);
}

/** The `{ error: { code } }` body every route returns on failure. */
export function parseErrorCode(value: unknown, status: number) {
  const code = (value as { error?: { code?: unknown } } | null)?.error?.code;
  if (typeof code === "string" && /^[a-z_]{1,64}$/.test(code)) return code;
  return status === 401 ? "authentication_required" : "service_unavailable";
}

export function parseStudentClass(value: unknown): StudentClass {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (
    typeof row.class_id !== "string" || !UUID.test(row.class_id) || typeof row.name !== "string" ||
    typeof row.grade_level !== "number" || !Number.isInteger(row.grade_level) || typeof row.teacher_names !== "string"
  ) {
    throw new Error("Invalid class.");
  }
  return { class_id: row.class_id, name: row.name, grade_level: row.grade_level, teacher_names: row.teacher_names,
    joined_at: timestamp(row.joined_at) };
}

export function parseStudentClassList(value: unknown): StudentClass[] {
  const classes = (value as { classes?: unknown } | null)?.classes;
  if (!Array.isArray(classes)) throw new Error("Invalid class list.");
  return classes.map(parseStudentClass);
}

export function parseJoinResponse(value: unknown): { class: StudentClass; joined: boolean } {
  const joined = (value as { joined?: unknown } | null)?.joined;
  if (typeof joined !== "boolean") throw new Error("Invalid join response.");
  return { class: parseStudentClass((value as { class?: unknown }).class), joined };
}

export function parseRosterStudent(value: unknown): RosterStudent {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (typeof row.student_id !== "string" || !UUID.test(row.student_id) || typeof row.display_name !== "string") {
    throw new Error("Invalid roster entry.");
  }
  return { student_id: row.student_id, display_name: row.display_name, joined_at: timestamp(row.joined_at) };
}

export function parseRoster(value: unknown): RosterStudent[] {
  const students = (value as { students?: unknown } | null)?.students;
  if (!Array.isArray(students)) throw new Error("Invalid roster.");
  return students.map(parseRosterStudent);
}
