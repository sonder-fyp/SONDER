import { DiagnosticClient } from "./DiagnosticClient";

export default async function DiagnosticPage({ params, searchParams }: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ session?: string | string[] }>;
}) {
  const { unitId } = await params;
  const query = await searchParams;
  const sessionId = typeof query.session === "string" ? query.session : undefined;
  return <DiagnosticClient key={`${unitId}:${sessionId ?? "intro"}`} unitId={unitId} initialSession={sessionId} />;
}
