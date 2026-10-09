import { notFound } from "next/navigation";
import { getGenerationRun } from "@/fixtures/content/generation-run";
import { GenerationRunClient } from "./GenerationRunClient";

export function generateStaticParams() {
  return [{ runId: "gen-run-0912" }];
}

export default async function GenerationRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = getGenerationRun(runId);
  if (!run) notFound();
  return <GenerationRunClient run={run} />;
}
