import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { joinClass, listStudentClasses, productErrorResponse } from "@/lib/classes/server";
import { ClassRequestError, parseJoinRequest } from "@/lib/classes/validation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

/** The signed-in student's active classes. */
export const GET = withAccess(["student"], async ({ appUserId }) => {
  return NextResponse.json({ classes: await listStudentClasses(appUserId) }, { headers });
});

/** Join a class by its code. Repeating a join is harmless and returns joined: false. */
export const POST = withAccess(["student"], async ({ appUserId }, request) => {
  let code: string;
  try {
    code = parseJoinRequest(await request.json());
  } catch (error) {
    if (error instanceof ClassRequestError) return errorResponse(error.code, 422);
    return errorResponse("invalid_request", 422);
  }
  try {
    const { classId, joined } = await joinClass(appUserId, code);
    const joinedClass = (await listStudentClasses(appUserId)).find((room) => room.class_id === classId);
    if (!joinedClass) throw new Error("A joined class was not visible to its student.");
    return NextResponse.json({ class: joinedClass, joined }, { headers });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
