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
  return <DiagnosticClient key={`${unitId}:${sessionId ?? "intro"}:${assignmentId ?? "none"}`} unitId={unitId} initialSession={sessionId} assignmentId={assignmentId} />;
}
