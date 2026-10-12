import "server-only";
import { NextResponse } from "next/server";
import { BoundaryError, engine } from "./server";
import { beginOwner, capability, checkOrigin, cookieName, sessionOwner } from "./owner";
import { parseAnswer, parseBegin, parseCatalogue, parseSnapshot } from "./validation";
import type { Snapshot } from "./types";

const headers = { "Cache-Control": "no-store" };
async function safe(work: () => Promise<Response>) {
  try { return await work(); }
  catch (error) {
    const e = error instanceof BoundaryError ? error : new BoundaryError(503, "engine_unavailable");
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
function reply(snapshot: Snapshot, owner: string, expectedId?: string) {
  if (expectedId && snapshot.session_id !== expectedId) throw new BoundaryError(503, "engine_unavailable");
  const response = NextResponse.json(snapshot, { headers });
  response.cookies.set(cookieName(snapshot.session_id), capability(snapshot.session_id, owner), {
    httpOnly: true, sameSite: "strict", secure: false,
    path: `/api/diagnostic/sessions/${snapshot.session_id}`, maxAge: 86400,
  });
  return response;
}
export function catalogueRoute() {
  return safe(async () => NextResponse.json(await engine("/engine/units", parseCatalogue), { headers }));
}
export function beginRoute(request: Request) {
  return safe(async () => {
    checkOrigin(request);
    const payload = await body(request, parseBegin), owner = beginOwner(payload.create_request_id);
    const snapshot = await engine("/engine/sessions", parseSnapshot, owner, payload);
    if (snapshot.unit.unit_id !== payload.unit_id) throw new BoundaryError(503, "engine_unavailable");
    return reply(snapshot, owner);
  });
}
export function currentRoute(request: Request, sid: string) {
  return safe(async () => {
    const owner = sessionOwner(request, sid);
    return reply(await engine(`/engine/sessions/${sid}`, parseSnapshot, owner), owner, sid);
  });
}
export function answerRoute(request: Request, sid: string) {
  return safe(async () => {
    checkOrigin(request);
    const owner = sessionOwner(request, sid), payload = await body(request, parseAnswer);
    return reply(await engine(`/engine/sessions/${sid}/answers`, parseSnapshot, owner, payload), owner, sid);
  });
}
