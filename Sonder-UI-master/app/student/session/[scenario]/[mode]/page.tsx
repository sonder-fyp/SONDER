import { notFound } from "next/navigation";
import { getScenario } from "@/fixtures/scenarios";
import { SessionClient } from "./SessionClient";

export function generateStaticParams() {
  return (["A", "B", "C"] as const).flatMap((scenario) => [
    { scenario, mode: "topic" },
    { scenario, mode: "general" },
  ]);
}

export default async function SessionPage({
  params,
}: {
  params: Promise<{ scenario: string; mode: string }>;
}) {
  const { scenario: id, mode } = await params;
  const scenario = getScenario(id);
  if (!scenario || (mode !== "topic" && mode !== "general")) notFound();

  return <SessionClient scenario={scenario} mode={mode as "topic" | "general"} />;
}
