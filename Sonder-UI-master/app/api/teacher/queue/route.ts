import { NextResponse } from "next/server";
import { withAccess } from "@/lib/auth/guard";
import { teacherQueue } from "@/lib/teacher/server";

export const runtime = "nodejs";

/** Finished checks waiting for the teacher across all their classes (needs review or follow-up required). */
export const GET = withAccess(["teacher"], async ({ appUserId }) =>
  NextResponse.json({ rows: await teacherQueue(appUserId) }, { headers: { "Cache-Control": "no-store" } }));
