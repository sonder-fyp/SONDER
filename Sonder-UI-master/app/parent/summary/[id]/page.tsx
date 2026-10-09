import { notFound } from "next/navigation";
import { PARENT_SUMMARIES, getParentSummary } from "@/fixtures/parent";
import { SummaryView } from "./SummaryView";

export function generateStaticParams() {
  return PARENT_SUMMARIES.map((s) => ({ id: s.id }));
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const summary = getParentSummary(id);
  if (!summary) notFound();
  return <SummaryView summary={summary} />;
}
