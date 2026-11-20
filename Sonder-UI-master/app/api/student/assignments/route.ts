import { NextResponse } from "next/server";
import { withAccess } from "@/lib/auth/guard";
import { listStudentAssignments } from "@/lib/classes/server";

export const runtime = "nodejs";

/** Open assignments of the signed-in student's active classes. No content, answer or result fields. */
export const GET = withAccess(["student"], async ({ appUserId }) => {
  return NextResponse.json({ assignments: await listStudentAssignments(appUserId) }, { headers: { "Cache-Control": "no-store" } });
});
