"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { classesClient, ClassesError } from "@/lib/classes/client";
import { actionFor, type StudentAssignmentCard } from "@/lib/student/dashboard";

function progress(card: StudentAssignmentCard) {
  if (card.latest_state === "in_progress") return `In progress · ${card.answered} answered`;
  if (card.latest_state === "submitted") return card.attempts > 1 ? `Submitted · attempt ${card.attempts}` : "Submitted";
  return "Not started";
}

/** The student's assignments with one action each: Start, Resume or Done (I2-A16, I2-A17). With classId, one class only. */
export function StudentAssignments({ classId, title = "Your assignments" }: { classId?: string; title?: string }) {
  const [cards, setCards] = useState<StudentAssignmentCard[]>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.studentDashboard()
      .then((value) => { if (active) { setCards(value); setError(null); } })
      .catch((cause) => { if (active) setError(cause instanceof ClassesError ? cause.code : "service_unavailable"); });
    return () => { active = false; };
  }, [attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo={classId ? `/student/classes/${classId}` : "/student"} />;
  const shown = cards && classId ? cards.filter((c) => c.class_id === classId) : cards;
  const headingId = classId ? "class-assignments" : "your-assignments";
  return (
    <section aria-labelledby={headingId} className="py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight">{title}</h2>
        <Link href="/student/history" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Past checks
        </Link>
      </div>
      {error ? (
        <div role="alert" className="border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load your assignments. Your saved answers are safe.</p>
          <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </div>
      ) : !shown ? (
        <p role="status" className="text-muted-foreground">Loading your assignments…</p>
      ) : !shown.length ? (
        classId ? (
          <p className="max-w-xl text-muted-foreground">Nothing is assigned in this class right now.</p>
        ) : (
          <p className="max-w-xl text-muted-foreground">
            Nothing is assigned right now. If your teacher gave you a class code,{" "}
            <Link href="/student/classes" className="text-foreground underline underline-offset-4 hover:text-accent">join your class</Link>.
          </p>
        )
      ) : (
        <ul className="border-t border-border">
          {shown.map((card) => {
            const action = actionFor(card);
            return (
              <li key={card.assignment_id} className="flex flex-wrap items-center justify-between gap-6 border-b border-border px-2 py-6">
                <div>
                  <p className="label text-muted-foreground">{card.class_name}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight">{card.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {card.unit_name} · {card.attempt_rule === "single" ? "One attempt" : "Repeat attempts allowed"} · {progress(card)}
                    {card.assignment_status === "closed" ? " · Closed by your teacher; you can still finish it" : ""}
                  </p>
                </div>
                {action.kind === "done" ? (
                  <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><Check className="size-4" aria-hidden />{action.label}</span>
                ) : (
                  <Link href={action.href} className={buttonVariants({ variant: action.kind === "resume" ? "primary" : "outline" })}
                    aria-label={`${action.label}: ${card.title}`}>
                    {action.label}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
