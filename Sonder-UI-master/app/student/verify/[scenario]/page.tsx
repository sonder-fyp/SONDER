import { notFound } from "next/navigation";
import { getScenario } from "@/fixtures/scenarios";
import { VerifyClient } from "./VerifyClient";

export function generateStaticParams() {
  return [{ scenario: "A" }, { scenario: "B" }];
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario: id } = await params;
  const scenario = getScenario(id);
  const check = scenario?.verification;
  if (!scenario || !check) notFound();

  return <VerifyClient check={check} />;
}
