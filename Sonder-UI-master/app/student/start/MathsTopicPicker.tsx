"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { diagnosticClient, DiagnosticError } from "@/lib/diagnostic/client";
import type { Catalogue } from "@/lib/diagnostic/types";

export function MathsTopicPicker() {
  const [catalogue, setCatalogue] = useState<Catalogue>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    diagnosticClient
      .catalogue()
      .then((value) => {
        if (active) setCatalogue(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof DiagnosticError
              ? cause.code
              : "service_unavailable",
          );
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  if (error)
    return (
      <section
        role="alert"
        className="my-10 border-l-2 border-attention py-3 pl-6"
      >
        <h2 className="text-xl font-semibold">
          {error === "authentication_required"
            ? "Please sign in again"
            : "We could not load diagnostics"}
        </h2>
        <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">
          {error === "authentication_required"
            ? "Your session has ended. Sign in to return to the available topics."
            : "Your saved checks have not changed. Try again in a moment."}
        </p>
        {error === "authentication_required" ? (
          <Link
            className={`${buttonVariants()} mt-6`}
            href="/auth/sign-in?next=%2Fstudent%2Fstart"
          >
            Log in
          </Link>
        ) : (
          <Button
            className="mt-6"
            onClick={() => {
              setError(null);
              setAttempt(attempt + 1);
            }}
          >
            Retry
          </Button>
        )}
      </section>
    );
  if (!catalogue)
    return (
      <div role="status" className="py-10">
        <p className="text-muted-foreground">Loading available topics…</p>
        <div
          aria-hidden
          className="mt-6 h-24 border-y border-border bg-muted/30 motion-safe:animate-pulse"
        />
      </div>
    );
  if (!catalogue.units.length)
    return (
      <section className="py-12">
        <h2 className="text-2xl font-semibold">No topics are available yet</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">
          Check back when your teacher has made a diagnostic available.
        </p>
      </section>
    );
  return (
    <section className="py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Mathematics</h2>
        <p className="text-sm text-muted-foreground">
          {catalogue.units.length} available{" "}
          {catalogue.units.length === 1 ? "topic" : "topics"}
        </p>
      </div>
      <div className="border-t border-border">
        {catalogue.units.map((unit) => (
          <Link
            key={unit.unit_id}
            href={`/student/diagnostic/${encodeURIComponent(unit.unit_id)}`}
            aria-label={`${unit.name}, up to ${catalogue.question_budget} questions`}
            className="group flex min-h-28 items-center justify-between gap-6 border-b border-border px-2 py-6 hover:bg-muted"
          >
            <div>
              <h3 className="text-xl font-semibold tracking-tight md:text-2xl">
                {unit.name}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a check or continue saved answers
              </p>
            </div>
            <ArrowRight
              className="size-5 shrink-0 text-accent transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
        ))}
      </div>
      <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
        You need an active Mathematics class enrolment to begin. If you cannot
        start a check, ask your teacher about access.
      </p>
    </section>
  );
}
