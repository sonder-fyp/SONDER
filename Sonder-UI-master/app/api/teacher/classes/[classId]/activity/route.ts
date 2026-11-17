import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { getTeacherClass } from "@/lib/classes/server";
import { classActivity } from "@/lib/teacher/server";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * One row per student and open assignment of one of the teacher's classes; ?assignment=<id> narrows to
 * one assignment (open or closed). Counts are computed from these rows by the page.
 */
export const GET = withAccess(["teacher"], async ({ appUserId }, request, context: { params: Promise<{ classId: string }> }) => {
  const { classId } = await context.params;
  const assignment = new URL(request.url).searchParams.get("assignment");
  if (assignment !== null && !UUID.test(assignment)) return errorResponse("assignment_not_found", 404);
  if (!(await getTeacherClass(appUserId, classId))) return errorResponse("class_not_found", 404);
  return NextResponse.json({ rows: await classActivity(appUserId, classId, assignment) },
    { headers: { "Cache-Control": "no-store" } });
});
