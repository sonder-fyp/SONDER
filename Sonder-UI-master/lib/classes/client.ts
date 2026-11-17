import {
  parseErrorCode, parseJoinResponse, parseRoster, parseStudentClassList, parseTeacherClassList, parseTeacherClassResponse,
} from "./validation";
import type { ClassStatus, CreateClassRequest } from "./types";

export class ClassesError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function request<T>(path: string, parser: (value: unknown) => T, method: Method = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ClassesError("service_unavailable");
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ClassesError(response.ok ? "service_unavailable" : parseErrorCode(null, response.status));
  }
  if (!response.ok) throw new ClassesError(parseErrorCode(data, response.status));
  try {
    return parser(data);
  } catch {
    throw new ClassesError("service_unavailable");
  }
}

const classPath = (classId: string) => `teacher/classes/${encodeURIComponent(classId)}`;
const done = () => undefined;

export const classesClient = {
  teacherClasses: () => request("teacher/classes", parseTeacherClassList),
  teacherClass: (classId: string) => request(classPath(classId), parseTeacherClassResponse),
  createClass: (input: CreateClassRequest) => request("teacher/classes", parseTeacherClassResponse, "POST", input),
  setClassStatus: (classId: string, status: ClassStatus) =>
    request(classPath(classId), parseTeacherClassResponse, "PATCH", { status }),
  newJoinCode: (classId: string) => request(`${classPath(classId)}/join-code`, parseTeacherClassResponse, "POST", {}),
  roster: (classId: string) => request(`${classPath(classId)}/roster`, parseRoster),
  removeStudent: (classId: string, studentId: string) =>
    request(`${classPath(classId)}/roster/${encodeURIComponent(studentId)}`, done, "DELETE"),
  studentClasses: () => request("student/classes", parseStudentClassList),
  joinClass: (code: string) => request("student/classes", parseJoinResponse, "POST", { code }),
};
