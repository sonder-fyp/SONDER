import { NextResponse } from "next/server";
import { withAccess } from "@/lib/auth/guard";
import { studentDashboard } from "@/lib/student/server";

export const runtime = "nodejs";

/** The signed-in student's open assignments with their own latest attempt. Student-safe fields only. */
export const GET = withAccess(["student"], async ({ appUserId }) => {
  return NextResponse.json({ assignments: await studentDashboard(appUserId) }, { headers: { "Cache-Control": "no-store" } });
});
