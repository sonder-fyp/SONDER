import { notFound } from "next/navigation";
import { getScenario } from "@/fixtures/scenarios";
import { ReviewPanel } from "./ReviewPanel";

export function generateStaticParams() {
  return [{ scenario: "A" }, { scenario: "B" }, { scenario: "C" }];
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario: id } = await params;
  const scenario = getScenario(id);
  if (!scenario) notFound();
  return <ReviewPanel scenario={scenario} />;
}
