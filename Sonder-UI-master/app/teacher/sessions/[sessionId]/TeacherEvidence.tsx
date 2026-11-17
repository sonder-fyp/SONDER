"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageMasthead } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { CONFIDENCE_NOTE, describeOutcome, percent } from "@/lib/teacher/describe";
import { teacherClient, TeacherError } from "@/lib/teacher/client";
import type { Evidence } from "@/lib/teacher/evidence";
import { QuestionCard } from "./QuestionCard";

const day = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function OutcomeCard({ evidence }: { evidence: Evidence }) {
  const summary = describeOutcome(evidence);
  return (
    <section aria-labelledby="outcome" className={`border-l-2 py-3 pl-6 ${summary.tone === "refusal" ? "border-attention" : "border-accent"}`}>
      <h2 id="outcome" className="text-2xl font-semibold tracking-tight">{summary.label}</h2>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{summary.detail}</p>
      {summary.reason ? (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <span className="label text-muted-foreground">Engine reason</span> <span className="text-foreground">{summary.reason}</span>
        </p>
      ) : null}
      <p className="mt-4 text-sm text-muted-foreground">{CONFIDENCE_NOTE}</p>
    </section>
  );
}

function Hypotheses({ evidence }: { evidence: Evidence }) {
  return (
    <section aria-labelledby="hypotheses" className="py-10">
      <h2 id="hypotheses" className="text-xl font-semibold tracking-tight">What the check could find</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Starting confidence for each explanation, before any answer.</p>
      <ul className="mt-4 grid max-w-3xl gap-1">
        {evidence.hypotheses.map((h) => (
          <li key={h.slot} className="flex justify-between gap-6 border-b border-border py-2 text-sm">
            <span>{h.name}{h.kind === "misconception" ? <span className="text-muted-foreground"> · {h.hypothesis_id}</span> : null}</span>
            <span className="tabular-nums text-muted-foreground">{percent(h.prior)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TeacherEvidence({ sessionId }: { sessionId: string }) {
  const [evidence, setEvidence] = useState<Evidence>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    teacherClient.evidence(sessionId)
      .then((value) => { if (active) setEvidence(value); })
      .catch((cause) => { if (active) setError(cause instanceof TeacherError ? cause.code : "service_unavailable"); });
    return () => { active = false; };
  }, [sessionId, attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo={`/teacher/sessions/${sessionId}`} />;
  if (error === "session_not_found")
    return (
      <>
        <PageMasthead label="Teacher" title="Check not found" lede="This check does not exist or is not from one of your classes." />
        <div className="py-10">
          <Link href="/teacher/classes" className={buttonVariants({ variant: "ghost" })}><ArrowLeft className="size-4" aria-hidden />Your classes</Link>
        </div>
      </>
    );
  if (error)
    return (
      <>
        <PageMasthead label="Teacher" title="Check evidence" />
        <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
          <h2 className="text-xl font-semibold">We could not load this check</h2>
          <p className="mt-3 max-w-lg text-muted-foreground">Nothing has changed. Try again in a moment.</p>
          <Button className="mt-6" onClick={() => { setError(null); setAttempt(attempt + 1); }}>Retry</Button>
        </section>
      </>
    );
  if (!evidence)
    return (
      <>
        <PageMasthead label="Teacher" title="Check evidence" />
        <div role="status" className="py-10">
          <p className="text-muted-foreground">Loading the check…</p>
          <div aria-hidden className="mt-6 h-24 border-y border-border bg-muted/30 motion-safe:animate-pulse" />
        </div>
      </>
    );

  const stepOf = new Map(evidence.steps.map((step) => [step.step_index, step]));
  return (
    <>
      <PageMasthead
        label={evidence.assignment ? evidence.assignment.title : "Diagnostic check"}
        title={evidence.student.display_name}
        lede={`${evidence.class.name} · ${evidence.unit_id} · started ${day(evidence.started_at)}${evidence.ended_at ? ` · finished ${day(evidence.ended_at)}` : ""}`}
        actions={<Link href={`/teacher/classes/${evidence.class.class_id}`} className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden />{evidence.class.name}</Link>}
      />
      <div className="pt-10"><OutcomeCard evidence={evidence} /></div>
      <Hypotheses evidence={evidence} />
      <section aria-labelledby="questions" className="pb-10">
        <h2 id="questions" className="text-xl font-semibold tracking-tight">Question by question</h2>
        <ol className="mt-4">
          {evidence.questions.map((question, index) => (
            <QuestionCard key={question.step_index} evidence={evidence} question={question}
              step={stepOf.get(question.step_index)} number={index + 1} />
          ))}
        </ol>
      </section>
      <footer className="border-t border-border py-6 text-xs text-faint">
        <p>Release {evidence.release} · engine {evidence.engine_release} · parameters {evidence.params_sha256.slice(0, 12)}</p>
        <p className="mt-1">Shown from the stored record of this check; later content changes do not alter it.</p>
      </footer>
    </>
  );
}
