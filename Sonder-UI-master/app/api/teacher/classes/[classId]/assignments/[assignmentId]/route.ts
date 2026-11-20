import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { listClassAssignments, productErrorResponse, setAssignmentStatus } from "@/lib/classes/server";
import { ClassRequestError, parseAssignmentStatusRequest, UUID } from "@/lib/classes/validation";

export const runtime = "nodejs";

/** Close an assignment (students no longer see or start it) or reopen it. Returns the updated assignment. */
export const PATCH = withAccess(["teacher"], async ({ appUserId }, request,
  context: { params: Promise<{ classId: string; assignmentId: string }> }) => {
  const { classId, assignmentId } = await context.params;
  if (!UUID.test(classId) || !UUID.test(assignmentId)) return errorResponse("assignment_not_found", 404);
  let status;
  try {
    status = parseAssignmentStatusRequest(await request.json());
  } catch (error) {
    return errorResponse(error instanceof ClassRequestError ? error.code : "invalid_request", 422);
  }
  try {
    // The assignment must belong to this class of this teacher (the list is empty for anyone else).
    if (!(await listClassAssignments(appUserId, classId)).some((item) => item.assignment_id === assignmentId)) {
      return errorResponse("assignment_not_found", 404);
    }
    await setAssignmentStatus(appUserId, assignmentId, status);
    const updated = (await listClassAssignments(appUserId, classId)).find((item) => item.assignment_id === assignmentId);
    if (!updated) return errorResponse("assignment_not_found", 404);
    return NextResponse.json({ assignment: updated }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
