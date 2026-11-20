import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { getTeacherClass, productErrorResponse, regenerateJoinCode } from "@/lib/classes/server";
import { UUID } from "@/lib/classes/validation";

export const runtime = "nodejs";

/** Replace the class's join code; the old code stops working at once. Returns the updated class. */
export const POST = withAccess(["teacher"], async ({ appUserId }, _request, context: { params: Promise<{ classId: string }> }) => {
  const { classId } = await context.params;
  if (!UUID.test(classId)) return errorResponse("class_not_found", 404);
  try {
    await regenerateJoinCode(appUserId, classId);
    const updated = await getTeacherClass(appUserId, classId);
    if (!updated) return errorResponse("class_not_found", 404);
    return NextResponse.json({ class: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
