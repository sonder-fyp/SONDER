import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { productErrorResponse, removeStudent } from "@/lib/classes/server";
import { UUID } from "@/lib/classes/validation";

export const runtime = "nodejs";

/** Remove a student from one of the teacher's classes (the enrolment is kept as "left"). */
export const DELETE = withAccess(["teacher"], async ({ appUserId }, _request,
  context: { params: Promise<{ classId: string; studentId: string }> }) => {
  const { classId, studentId } = await context.params;
  if (!UUID.test(classId)) return errorResponse("class_not_found", 404);
  if (!UUID.test(studentId)) return errorResponse("student_not_found", 404);
  try {
    await removeStudent(appUserId, classId, studentId);
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
