"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { diagnosticClient } from "@/lib/diagnostic/client";
import type { Catalogue } from "@/lib/diagnostic/types";

export function MathsTopicPicker() {
  const [catalogue, setCatalogue] = useState<Catalogue>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    diagnosticClient.catalogue().then(value => { if (active) setCatalogue(value); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  if (failed) return <div role="alert" className="mt-10">
    <p>Mathematics is unavailable. Please retry.</p>
    <Button className="mt-6" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry</Button>
  </div>;
  if (!catalogue) return <p role="status" className="mt-10">Loading Mathematics topics</p>;
  return <div className="mt-12 border-t border-border">{catalogue.units.map(unit =>
    <Link key={unit.unit_id} href={`/student/diagnostic/${unit.unit_id}`}
      aria-label={`${unit.name}, ${unit.item_count} questions in this topic`}
      className="flex min-h-24 flex-col justify-center border-b border-border py-6 hover:bg-muted">
      <span className="text-2xl font-semibold tracking-tight">{unit.name}</span>
      <span className="mt-2 text-base text-muted-foreground">{unit.item_count} questions in this topic</span>
    </Link>)}</div>;
}
