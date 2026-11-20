import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import {
  createAssignment, getTeacherClass, listClassAssignments, productErrorResponse, runningContentVersion,
} from "@/lib/classes/server";
import { ClassRequestError, parseCreateAssignment } from "@/lib/classes/validation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ classId: string }> };

/** Every assignment of one of the teacher's classes, newest first; any other class is not found. */
export const GET = withAccess(["teacher"], async ({ appUserId }, _request, context: Context) => {
  const { classId } = await context.params;
  if (!(await getTeacherClass(appUserId, classId))) return errorResponse("class_not_found", 404);
  return NextResponse.json({ assignments: await listClassAssignments(appUserId, classId) }, { headers });
});

/** Assign a unit of the release the diagnostic service is running to the class. */
export const POST = withAccess(["teacher"], async ({ appUserId }, request, context: Context) => {
  const { classId } = await context.params;
  if (!(await getTeacherClass(appUserId, classId))) return errorResponse("class_not_found", 404);
  let input;
  try {
    input = parseCreateAssignment(await request.json());
  } catch (error) {
    return errorResponse(error instanceof ClassRequestError ? error.code : "invalid_request", 422);
  }
  try {
    const version = await runningContentVersion();
    const id = await createAssignment(appUserId, classId, version, input);
    const created = (await listClassAssignments(appUserId, classId)).find((item) => item.assignment_id === id);
    if (!created) throw new Error("A created assignment was not visible to its teacher.");
    return NextResponse.json({ assignment: created }, { status: 201, headers });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
