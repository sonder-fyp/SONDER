import { NextResponse } from "next/server";
import { withAccess } from "@/lib/auth/guard";
import { studentHistory } from "@/lib/student/server";

export const runtime = "nodejs";

/** The signed-in student's own checks, newest first. Student-safe fields only. */
export const GET = withAccess(["student"], async ({ appUserId }) => {
  return NextResponse.json({ history: await studentHistory(appUserId) }, { headers: { "Cache-Control": "no-store" } });
});
