"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherClient } from "@/lib/teacher/client";
import type { Attempt } from "@/lib/teacher/attempts";

const REVIEW_LABEL = { reviewed: "Reviewed", follow_up_required: "Follow-up required" } as const;

/** Every attempt at this assignment; a convenience, so it renders nothing while loading, on error or for one attempt. */
export function AttemptList({ sessionId }: { sessionId: string }) {
  const [attempts, setAttempts] = useState<Attempt[]>();
  useEffect(() => {
    let active = true;
    teacherClient.attempts(sessionId)
      .then((value) => { if (active) setAttempts(value); })
      .catch(() => { if (active) setAttempts(undefined); });
    return () => { active = false; };
  }, [sessionId]);
  if (!attempts || attempts.length <= 1) return null;
  return (
    <nav aria-label="Attempts at this assignment" className="pt-10">
      <h2 className="label text-muted-foreground">Attempts at this assignment</h2>
      <ol className="mt-3 grid gap-1 text-sm">
        {attempts.map((a) => {
          const text = `Attempt ${a.attempt_number} · ${a.state === "in_progress" ? "In progress" : "Completed"}${
            a.state === "completed" ? ` · ${a.review_status ? REVIEW_LABEL[a.review_status] : "Not reviewed"}` : ""}`;
          return (
            <li key={a.session_id}>
              {a.session_id === sessionId ? (
                <span aria-current="page">{text} (this attempt)</span>
              ) : (
                <Link href={`/teacher/sessions/${a.session_id}`} className="text-foreground underline underline-offset-4 hover:text-accent">{text}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
