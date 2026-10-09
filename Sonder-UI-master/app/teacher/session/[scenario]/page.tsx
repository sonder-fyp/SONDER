import { notFound } from "next/navigation";
import { getScenario } from "@/fixtures/scenarios";
import { EvidencePanel } from "./EvidencePanel";

export function generateStaticParams() {
  return [{ scenario: "A" }, { scenario: "B" }, { scenario: "C" }];
}

export default async function EvidencePage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario: id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();
  return <EvidencePanel scenario={scenario} />;
}
