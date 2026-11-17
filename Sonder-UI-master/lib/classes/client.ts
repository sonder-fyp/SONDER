import { parseErrorCode, parseTeacherClassList, parseTeacherClassResponse } from "./validation";
import type { CreateClassRequest } from "./types";

export class ClassesError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function request<T>(path: string, parser: (value: unknown) => T, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: body === undefined ? "GET" : "POST",
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

export const classesClient = {
  teacherClasses: () => request("teacher/classes", parseTeacherClassList),
  teacherClass: (classId: string) => request(`teacher/classes/${encodeURIComponent(classId)}`, parseTeacherClassResponse),
  createClass: (input: CreateClassRequest) => request("teacher/classes", parseTeacherClassResponse, input),
};
