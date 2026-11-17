import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { classRoster, getTeacherClass } from "@/lib/classes/server";

export const runtime = "nodejs";

/** Active students of one of the teacher's classes; any other class is not found. */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: { params: Promise<{ classId: string }> }) => {
  const { classId } = await context.params;
  if (!(await getTeacherClass(appUserId, classId))) return errorResponse("class_not_found", 404);
  return NextResponse.json({ students: await classRoster(appUserId, classId) }, { headers: { "Cache-Control": "no-store" } });
});
