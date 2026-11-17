import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { getTeacherClass } from "@/lib/classes/server";

export const runtime = "nodejs";

/** One class, only for a teacher who actively teaches it. Any other id is "not found", so ids cannot be probed. */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: { params: Promise<{ classId: string }> }) => {
  const found = await getTeacherClass(appUserId, (await context.params).classId);
  if (!found) return errorResponse("class_not_found", 404);
  return NextResponse.json({ class: found }, { headers: { "Cache-Control": "no-store" } });
});
