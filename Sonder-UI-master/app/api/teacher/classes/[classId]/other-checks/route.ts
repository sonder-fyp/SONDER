import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { getTeacherClass } from "@/lib/classes/server";
import { classOtherChecks } from "@/lib/teacher/server";

export const runtime = "nodejs";

/** A class's checks started without an assignment (the retired self-start path), read-only. */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: { params: Promise<{ classId: string }> }) => {
  const { classId } = await context.params;
  if (!(await getTeacherClass(appUserId, classId))) return errorResponse("class_not_found", 404);
  return NextResponse.json({ checks: await classOtherChecks(appUserId, classId) }, { headers: { "Cache-Control": "no-store" } });
});
