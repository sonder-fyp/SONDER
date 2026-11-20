import type {
  AssignableUnit, AssignmentStatus, AttemptRule, ClassStatus, CreateAssignmentRequest, CreateClassRequest, RosterStudent,
  StudentAssignment, StudentClass, TeacherAssignment, TeacherClass,
} from "./types";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const CLASS_NAME_MAX = 80;
export const CLASS_NOTE_MAX = 500;
export const ASSIGNMENT_TITLE_MAX = 120;
const UNIT_CODE = /^[A-Za-z0-9_-]{1,32}$/;

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

function fields(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClassRequestError("invalid_request");
  return body as Record<string, unknown>;
}

/** Validate a create-assignment body. The database applies the same rules; this gives the typed error first. */
export function parseCreateAssignment(body: unknown): CreateAssignmentRequest {
  const { unit_id, title, attempt_rule } = fields(body);
  if (typeof unit_id !== "string" || !UNIT_CODE.test(unit_id)) throw new ClassRequestError("unit_not_found");
  if (typeof title !== "string" || !title.trim() || title.trim().length > ASSIGNMENT_TITLE_MAX) {
    throw new ClassRequestError("assignment_title_invalid");
  }
  const rule = attempt_rule ?? "single";
  if (rule !== "single" && rule !== "repeat") throw new ClassRequestError("attempt_rule_invalid");
  return { unit_id, title: title.trim(), attempt_rule: rule };
}

export function parseAssignmentStatusRequest(body: unknown): AssignmentStatus {
  const { status } = fields(body);
  if (status !== "open" && status !== "closed") throw new ClassRequestError("assignment_status_invalid");
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

const isRule = (value: unknown): value is AttemptRule => value === "single" || value === "repeat";
const text = (value: unknown, max = 256): value is string => typeof value === "string" && value.length <= max;

export function parseTeacherAssignment(value: unknown): TeacherAssignment {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (
    typeof row.assignment_id !== "string" || !UUID.test(row.assignment_id) ||
    typeof row.class_id !== "string" || !UUID.test(row.class_id) ||
    !text(row.title, ASSIGNMENT_TITLE_MAX) || !text(row.unit_code, 32) || !text(row.unit_name) || !text(row.version_code) ||
    (row.status !== "open" && row.status !== "closed") || !isRule(row.attempt_rule)
  ) {
    throw new Error("Invalid assignment.");
  }
  return {
    assignment_id: row.assignment_id, class_id: row.class_id, title: row.title, unit_code: row.unit_code,
    unit_name: row.unit_name, version_code: row.version_code, status: row.status, attempt_rule: row.attempt_rule,
    created_at: timestamp(row.created_at),
  };
}

export function parseTeacherAssignmentList(value: unknown): TeacherAssignment[] {
  const list = (value as { assignments?: unknown } | null)?.assignments;
  if (!Array.isArray(list)) throw new Error("Invalid assignment list.");
  return list.map(parseTeacherAssignment);
}

export function parseTeacherAssignmentResponse(value: unknown): TeacherAssignment {
  return parseTeacherAssignment((value as { assignment?: unknown } | null)?.assignment);
}

/** Rebuilt field by field, so nothing beyond these fields can reach student JSON. */
export function parseStudentAssignment(value: unknown): StudentAssignment {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  if (
    typeof row.assignment_id !== "string" || !UUID.test(row.assignment_id) ||
    typeof row.class_id !== "string" || !UUID.test(row.class_id) ||
    !text(row.class_name) || !text(row.title, ASSIGNMENT_TITLE_MAX) || !text(row.unit_code, 32) || !text(row.unit_name) ||
    !isRule(row.attempt_rule)
  ) {
    throw new Error("Invalid assignment.");
  }
  return {
    assignment_id: row.assignment_id, class_id: row.class_id, class_name: row.class_name, title: row.title,
    unit_code: row.unit_code, unit_name: row.unit_name, attempt_rule: row.attempt_rule, created_at: timestamp(row.created_at),
  };
}

export function parseStudentAssignmentList(value: unknown): StudentAssignment[] {
  const list = (value as { assignments?: unknown } | null)?.assignments;
  if (!Array.isArray(list)) throw new Error("Invalid assignment list.");
  return list.map(parseStudentAssignment);
}

export function parseAssignableUnits(value: unknown): AssignableUnit[] {
  const list = (value as { units?: unknown } | null)?.units;
  if (!Array.isArray(list)) throw new Error("Invalid units.");
  return list.map((raw) => {
    const unit = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (typeof unit.unit_id !== "string" || !UNIT_CODE.test(unit.unit_id) || !text(unit.name)) throw new Error("Invalid unit.");
    return { unit_id: unit.unit_id, name: unit.name };
  });
}
