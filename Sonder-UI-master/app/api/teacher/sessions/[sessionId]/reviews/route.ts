import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { productErrorResponse } from "@/lib/classes/server";
import { parseAddReview, ReviewRequestError } from "@/lib/teacher/reviews";
import { addReview, listReviews, teacherCanSee } from "@/lib/teacher/server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ sessionId: string }> };

/** The review revisions of one check, oldest first, for a teacher of its class (404 otherwise). */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: Context) => {
  const { sessionId } = await context.params;
  if (!(await teacherCanSee(appUserId, sessionId))) return errorResponse("session_not_found", 404);
  return NextResponse.json({ reviews: await listReviews(appUserId, sessionId) }, { headers });
});

/**
 * Append a review revision. The body names the revision the teacher saw (expected_revision; 0 when
 * unreviewed) and a request key per attempt, so a stale write is refused and a retry is harmless.
 */
export const POST = withAccess(["teacher"], async ({ appUserId }, request, context: Context) => {
  const { sessionId } = await context.params;
  if (!(await teacherCanSee(appUserId, sessionId))) return errorResponse("session_not_found", 404);
  let input;
  try {
    input = parseAddReview(await request.json());
  } catch (error) {
    return errorResponse(error instanceof ReviewRequestError ? error.code : "invalid_request", 422);
  }
  try {
    await addReview(appUserId, sessionId, input);
    return NextResponse.json({ reviews: await listReviews(appUserId, sessionId) }, { status: 201, headers });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
