import { parseCatalogue, parseError, parseSnapshot } from "./validation";
import type { AnswerRequest, BeginRequest } from "./types";

export class DiagnosticError extends Error {
  constructor(public code: string) { super(code); }
}
async function request<T>(path: string, parser: (v: unknown) => T, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/diagnostic/${path}`, {
      method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
  } catch { throw new DiagnosticError("engine_unavailable"); }
  try {
    const data: unknown = await response.json();
    if (!response.ok) throw new DiagnosticError(parseError(data, response.status));
    return parser(data);
  } catch (error) {
    if (error instanceof DiagnosticError) throw error;
    throw new DiagnosticError("engine_unavailable");
  }
}
export const diagnosticClient = {
  catalogue: () => request("units", parseCatalogue),
  begin: (payload: BeginRequest) => request("sessions", parseSnapshot, payload),
  current: (sid: string) => request(`sessions/${encodeURIComponent(sid)}`, parseSnapshot),
  answer: (sid: string, payload: AnswerRequest) => request(`sessions/${encodeURIComponent(sid)}/answers`, parseSnapshot, payload),
};
