import { NextResponse } from "next/server";
import { errorResponse, withAccess } from "@/lib/auth/guard";
import { createClass, getTeacherClass, listTeacherClasses, productErrorResponse } from "@/lib/classes/server";
import { ClassRequestError, parseCreateClass } from "@/lib/classes/validation";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

/** The signed-in teacher's own classes, newest first. */
export const GET = withAccess(["teacher"], async ({ appUserId }) => {
  return NextResponse.json({ classes: await listTeacherClasses(appUserId) }, { headers });
});

/** Create a Maths class owned by the signed-in teacher. */
export const POST = withAccess(["teacher"], async ({ appUserId }, request) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("invalid_request", 422);
  }
  let input;
  try {
    input = parseCreateClass(body);
  } catch (error) {
    if (error instanceof ClassRequestError) return errorResponse(error.code, 422);
    throw error;
  }
  try {
    const classId = await createClass(appUserId, input);
    const created = await getTeacherClass(appUserId, classId);
    if (!created) throw new Error("A created class was not visible to its teacher.");
    return NextResponse.json({ class: created }, { status: 201, headers });
  } catch (error) {
    return productErrorResponse(error);
  }
}, { mutation: true });
