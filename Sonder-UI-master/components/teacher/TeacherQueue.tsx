"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { teacherClient, TeacherError } from "@/lib/teacher/client";
import { orderedQueue, type QueueRow } from "@/lib/teacher/queue";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short" }) : "—");

function Group({ title, rows }: { title: string; rows: QueueRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold tracking-tight">{title} ({rows.length})</h3>
      <ul className="mt-3 border-t border-border">
        {rows.map((row) => (
          <li key={row.session_id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-2 py-4">
            <div>
              <p className="font-medium">{row.student_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.class_name} · {row.assignment_title ?? "Other check"} · {row.unit_code} · finished {day(row.ended_at)}
              </p>
            </div>
            <Link href={`/teacher/sessions/${row.session_id}`} className="text-sm text-foreground underline underline-offset-4 hover:text-accent"
              aria-label={`Open evidence: ${row.student_name}, ${row.assignment_title ?? "other check"}`}>
              Open evidence
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Finished checks waiting for the teacher across all their classes (sonder.teacher_queue). */
export function TeacherQueue() {
  const [rows, setRows] = useState<QueueRow[]>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    teacherClient.queue()
      .then((value) => { if (active) { setRows(orderedQueue(value)); setError(null); } })
      .catch((cause) => { if (active) setError(cause instanceof TeacherError ? cause.code : "service_unavailable"); });
    return () => { active = false; };
  }, [attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo="/teacher" />;
  return (
    <section aria-labelledby="waiting" className="py-10">
      <h2 id="waiting" className="text-2xl font-semibold tracking-tight">Waiting for you</h2>
      {error ? (
        <div role="alert" className="mt-6 border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load checks waiting for you.</p>
          <Button className="mt-4" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Retry</Button>
        </div>
      ) : !rows ? (
        <p role="status" className="mt-6 text-muted-foreground">Loading checks waiting for you…</p>
      ) : !rows.length ? (
        <p className="mt-6 max-w-xl text-muted-foreground">Nothing is waiting for you. Finished checks appear here until you review them.</p>
      ) : (
        <>
          <Group title="Needs review" rows={rows.filter((row) => row.review_status === null)} />
          <Group title="Follow-up required" rows={rows.filter((row) => row.review_status === "follow_up_required")} />
        </>
      )}
    </section>
  );
}
