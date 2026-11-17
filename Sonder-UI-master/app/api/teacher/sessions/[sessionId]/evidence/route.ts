import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { BoundaryError, engine } from "@/lib/diagnostic/server";
import { parseEvidence } from "@/lib/teacher/evidence";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The stored evidence of one session, for a teacher of the student's class only (404 otherwise). */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await context.params;
  if (!UUID.test(sessionId)) return errorResponse("session_not_found", 404);
  try {
    // The actor is the signed-in teacher from the session; the service checks class scope.
    const evidence = await engine(`/engine/teacher/sessions/${sessionId}/evidence`, parseEvidence, appUserId);
    if (evidence.session_id !== sessionId) return errorResponse("engine_unavailable", 503);
    return NextResponse.json({ evidence }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BoundaryError) return errorResponse(error.code, error.status);
    throw error;
  }
});
