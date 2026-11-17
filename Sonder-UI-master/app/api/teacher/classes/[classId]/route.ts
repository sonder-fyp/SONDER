import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { getTeacherClass, productErrorResponse, setClassStatus } from "@/lib/classes/server";
import { ClassRequestError, parseStatusRequest, UUID } from "@/lib/classes/validation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ classId: string }> };

/** One class, only for a teacher who actively teaches it. Any other id is "not found", so ids cannot be probed. */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: Context) => {
  const found = await getTeacherClass(appUserId, (await context.params).classId);
  if (!found) return errorResponse("class_not_found", 404);
  return NextResponse.json({ class: found }, { headers });
});

/** Archive a class (nobody can join it) or make it active again. Returns the updated class. */
export const PATCH = withAccess(["teacher"], async ({ appUserId }, request, context: Context) => {
  const { classId } = await context.params;
  if (!UUID.test(classId)) return errorResponse("class_not_found", 404);
  let status;
  try {
    status = parseStatusRequest(await request.json());
  } catch (error) {
    return errorResponse(error instanceof ClassRequestError ? error.code : "invalid_request", 422);
  }
  try {
    await setClassStatus(appUserId, classId, status);
    const updated = await getTeacherClass(appUserId, classId);
    if (!updated) return errorResponse("class_not_found", 404);
    return NextResponse.json({ class: updated }, { headers });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
