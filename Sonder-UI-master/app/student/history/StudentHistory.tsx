"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { classesClient, ClassesError } from "@/lib/classes/client";
import { resumeHref, type HistoryEntry } from "@/lib/student/history";

const day = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The student's own checks, newest first (I2-A18). No scores or results. */
export function StudentHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.studentHistory()
      .then((value) => { if (active) { setEntries(value); setError(null); } })
      .catch((cause) => { if (active) setError(cause instanceof ClassesError ? cause.code : "service_unavailable"); });
    return () => { active = false; };
  }, [attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo="/student/history" />;
  if (error)
    return (
      <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
        <h2 className="text-xl font-semibold">We could not load your history</h2>
        <p className="mt-3 max-w-lg text-muted-foreground">Your saved answers are safe. Try again in a moment.</p>
        <Button className="mt-6" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
      </section>
    );
  if (!entries) return <p role="status" className="py-10 text-muted-foreground">Loading your checks…</p>;
  if (!entries.length)
    return (
      <section className="py-10">
        <h2 className="text-2xl font-semibold">No checks yet</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">Checks you start will be listed here.</p>
      </section>
    );
  return (
    <ul className="my-10 border-t border-border">
      {entries.map((entry) => {
        const resume = resumeHref(entry);
        return (
          <li key={entry.session_id} className="flex flex-wrap items-center justify-between gap-6 border-b border-border px-2 py-6">
            <div>
              <p className="label text-muted-foreground">{entry.class_name}</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {entry.assignment_title ?? entry.unit_name}
                {entry.attempt_number ? <span className="text-muted-foreground"> · Attempt {entry.attempt_number}</span> : null}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {entry.unit_name} · started {day(entry.started_at)}
                {entry.ended_at ? ` · submitted ${day(entry.ended_at)}` : ""}
              </p>
              <p className="mt-1 text-sm">
                {entry.state === "in_progress" ? `In progress · ${entry.answered} answered` : `Submitted · ${entry.answered} questions answered`}
              </p>
            </div>
            {resume ? (
              <Link href={resume} className={buttonVariants()} aria-label={`Resume: ${entry.assignment_title ?? entry.unit_name}`}>
                Resume<ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
