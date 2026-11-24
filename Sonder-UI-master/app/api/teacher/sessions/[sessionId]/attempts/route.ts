import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { sessionAttempts, teacherCanSee } from "@/lib/teacher/server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Every attempt of the same student at the same assignment, for a teacher of the class (404 otherwise). */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await context.params;
  if (!UUID.test(sessionId) || !(await teacherCanSee(appUserId, sessionId))) return errorResponse("session_not_found", 404);
  return NextResponse.json({ attempts: await sessionAttempts(appUserId, sessionId) }, { headers: { "Cache-Control": "no-store" } });
});
