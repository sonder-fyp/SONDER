import { redirect } from "next/navigation";
import { ACCOUNT_ID } from "@/lib/diagnostic/validation";
import { DiagnosticClient } from "./DiagnosticClient";

export default async function DiagnosticPage({ params, searchParams }: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ session?: string | string[]; assignment?: string | string[] }>;
}) {
  const { unitId } = await params;
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session : undefined;
  const assignmentId = typeof query.assignment === "string" && ACCOUNT_ID.test(query.assignment) ? query.assignment : undefined;
  // Every check starts from an assignment; ?session= alone stays so an old unfinished check can be finished.
  if (!sessionId && !assignmentId) redirect("/student");
  return <DiagnosticClient key={`${unitId}:${sessionId ?? "intro"}:${assignmentId ?? "none"}`} unitId={unitId} initialSession={sessionId} assignmentId={assignmentId} />;
}
