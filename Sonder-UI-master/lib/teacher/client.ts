import { parseErrorCode } from "@/lib/classes/validation";
import { parseEvidence } from "./evidence";
import { parseReviewList } from "./reviews";
import type { AddReviewRequest } from "./reviews";

export class TeacherError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function request<T>(path: string, parser: (value: unknown) => T, method = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/teacher/${path}`, {
      method, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new TeacherError("service_unavailable");
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new TeacherError(response.ok ? "service_unavailable" : parseErrorCode(null, response.status));
  }
  if (!response.ok) throw new TeacherError(parseErrorCode(data, response.status));
  try {
    return parser(data);
  } catch {
    throw new TeacherError("service_unavailable");
  }
}

export const teacherClient = {
  evidence: (sessionId: string) =>
    request(`sessions/${encodeURIComponent(sessionId)}/evidence`, (v) => parseEvidence((v as { evidence?: unknown } | null)?.evidence)),
  reviews: (sessionId: string) => request(`sessions/${encodeURIComponent(sessionId)}/reviews`, parseReviewList),
  addReview: (sessionId: string, input: AddReviewRequest) =>
    request(`sessions/${encodeURIComponent(sessionId)}/reviews`, parseReviewList, "POST", input),
};
