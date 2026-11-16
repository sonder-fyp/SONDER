import "server-only";
import { NextResponse } from "next/server";
import { AccessError, requireApiRole } from "@/lib/auth/access";
import { BoundaryError, engine } from "./server";
import { checkOrigin } from "./origin";
import { ACCOUNT_ID, UUID, parseAnswer, parseBegin, parseCatalogue, parseSessionList, parseSnapshot } from "./validation";
import { parseLatest } from "./teacher";
import type { Snapshot } from "./types";

const headers = { "Cache-Control": "no-store" };
async function safe(work: () => Promise<Response>) {
  try { return await work(); }
  catch (error) {
    const e = error instanceof BoundaryError
      ? error
      : error instanceof AccessError
        ? new BoundaryError(error.status, error.status === 401 ? "authentication_required" : "role_required")
        : new BoundaryError(503, "engine_unavailable");
    return NextResponse.json({ error: { code: e.code } }, { status: e.status, headers });
  }
}
async function body<T>(request: Request, parser: (value: unknown) => T) {
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("Oversize");
    return parser(JSON.parse(raw));
  } catch { throw new BoundaryError(422, "invalid_request"); }
}
function json(value: unknown) { return NextResponse.json(value, { headers }); }
// The engine binds sessions to the application account, never to anything the browser sends.
async function studentActor() {
  const { account } = await requireApiRole(["student"]);
  if (!ACCOUNT_ID.test(account.id)) throw new BoundaryError(503, "engine_unavailable");
  return account.id;
}
function sessionId(sid: string) {
  if (!UUID.test(sid)) throw new BoundaryError(404, "session_unavailable");
  return sid;
}
function sameSession(snapshot: Snapshot, sid: string) {
  if (snapshot.session_id !== sid) throw new BoundaryError(503, "engine_unavailable");
  return snapshot;
}
export function catalogueRoute() {
  return safe(async () => {
    await requireApiRole(["student"]);
    return json(await engine("/engine/units", parseCatalogue));
  });
}
export function beginRoute(request: Request) {
  return safe(async () => {
    checkOrigin(request);
    const actor = await studentActor();
    const payload = await body(request, parseBegin);
    const snapshot = await engine("/engine/sessions", parseSnapshot, actor, payload);
    if (snapshot.unit.unit_id !== payload.unit_id) throw new BoundaryError(503, "engine_unavailable");
    return json(snapshot);
  });
}
export function currentRoute(request: Request, sid: string) {
  return safe(async () => {
    sessionId(sid);
    const actor = await studentActor();
    return json(sameSession(await engine(`/engine/sessions/${sid}`, parseSnapshot, actor), sid));
  });
}
export function answerRoute(request: Request, sid: string) {
  return safe(async () => {
    checkOrigin(request);
    sessionId(sid);
    const actor = await studentActor();
    const payload = await body(request, parseAnswer);
    return json(sameSession(await engine(`/engine/sessions/${sid}/answers`, parseSnapshot, actor, payload), sid));
  });
}
// Demo teacher view: the diagnostic that finished last. Read only; the token stays on the server.
export function latestTeacherRoute() {
  return safe(async () => {
    await requireApiRole(["teacher"]);
    return json(await engine("/engine/latest", parseLatest));
  });
}
