"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { TeacherClass } from "@/lib/classes/types";
import { teacherClient } from "@/lib/teacher/client";
import type { OtherCheck } from "@/lib/teacher/otherChecks";

const REVIEW_LABEL = { reviewed: "Reviewed", follow_up_required: "Follow-up required" } as const;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Checks started without an assignment, before assignments were required; read-only, hidden when there are none. */
export function OtherChecks({ room }: { room: TeacherClass }) {
  const [checks, setChecks] = useState<OtherCheck[]>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    teacherClient.otherChecks(room.class_id)
      .then((value) => { if (active) { setChecks(value); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [room.class_id, attempt]);

  if (failed)
    return (
      <div role="alert" className="py-4 text-sm">
        <p className="text-muted-foreground">We could not load other checks.</p>
        <Button className="mt-2" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
      </div>
    );
  if (!checks || !checks.length) return null;
  return (
    <section aria-labelledby="other-checks" className="py-10">
      <h2 id="other-checks" className="text-2xl font-semibold tracking-tight">Other checks</h2>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Checks your students started without an assignment, before assignments were required. They are not counted in Activity.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-normal">Student</th>
              <th scope="col" className="py-2 pr-4 font-normal">Topic</th>
              <th scope="col" className="py-2 pr-4 font-normal">Status</th>
              <th scope="col" className="py-2 pr-4 font-normal">Started</th>
              <th scope="col" className="py-2 pr-4 font-normal">Review</th>
              <th scope="col" className="py-2 font-normal"><span className="sr-only">Evidence</span></th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.session_id} className="border-b border-border">
                <td className="py-3 pr-4 font-medium">{check.student_name}</td>
                <td className="py-3 pr-4">{check.unit_name}</td>
                <td className="py-3 pr-4">{check.state === "in_progress" ? `In progress · ${check.answered} of ${check.question_budget}` : "Completed"}</td>
                <td className="py-3 pr-4 text-muted-foreground">{when(check.started_at)}</td>
                <td className="py-3 pr-4">{check.review_status ? REVIEW_LABEL[check.review_status] : check.state === "completed" ? "Not reviewed" : "—"}</td>
                <td className="py-3">
                  <Link href={`/teacher/sessions/${check.session_id}`} className="text-foreground underline underline-offset-4 hover:text-accent"
                    aria-label={`Evidence for ${check.student_name}, other check`}>Evidence</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
