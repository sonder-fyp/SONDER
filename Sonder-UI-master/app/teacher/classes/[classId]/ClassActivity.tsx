"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { classesClient } from "@/lib/classes/client";
import type { TeacherAssignment, TeacherClass } from "@/lib/classes/types";
import { teacherClient } from "@/lib/teacher/client";
import { counts, FILTERS, matches, ordered, type ActivityFilter, type ActivityRow } from "@/lib/teacher/activity";

const STATE_LABEL = { not_started: "Not started", in_progress: "In progress", completed: "Completed" } as const;
const REVIEW_LABEL = { reviewed: "Reviewed", follow_up_required: "Follow-up required" } as const;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** The class dashboard (I2-A11): counts and the rows they are counted from. */
export function ClassActivity({ room }: { room: TeacherClass }) {
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [rows, setRows] = useState<ActivityRow[]>();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    classesClient.assignments(room.class_id).then((list) => { if (active) setAssignments(list); }).catch(() => undefined);
    return () => { active = false; };
  }, [room.class_id]);

  useEffect(() => {
    let active = true;
    teacherClient.activity(room.class_id, assignmentId || undefined)
      .then((value) => { if (active) { setRows(value); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [room.class_id, assignmentId, attempt]);

  const summary = rows ? counts(rows) : null;
  const shown = rows ? ordered(rows.filter((row) => matches(row, filter))) : [];

  return (
    <section aria-labelledby="activity" className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="activity" className="text-2xl font-semibold tracking-tight">Activity</h2>
        <label className="grid gap-1 text-sm">
          <span className="label text-muted-foreground">Assignment</span>
          <select value={assignmentId} onChange={(event) => { setAssignmentId(event.target.value); setRows(undefined); }}
            className="h-11 border border-border-strong bg-input px-3 text-base text-foreground focus:border-accent">
            <option value="">All open assignments</option>
            {assignments.map((a) => (
              <option key={a.assignment_id} value={a.assignment_id}>{a.title}{a.status === "closed" ? " (closed)" : ""}</option>
            ))}
          </select>
        </label>
      </div>
      {failed ? (
        <div role="alert" className="mt-6 border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load this class&apos;s activity.</p>
          <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </div>
      ) : !rows || !summary ? (
        <p role="status" className="mt-6 text-muted-foreground">Loading activity…</p>
      ) : !rows.length ? (
        <p className="mt-6 max-w-xl text-muted-foreground">
          {assignments.length ? "No students have joined yet, so there is no activity." : "Assign a topic below to see who has started and finished it."}
        </p>
      ) : (
        <>
          <div role="group" aria-label="Filter by status" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={filter === f.value} title={f.definition}
                onClick={() => setFilter(f.value)}
                className={`border px-3 py-3 text-left transition-colors ${filter === f.value ? "border-accent bg-muted" : "border-border hover:border-border-hover"}`}>
                <span className="block text-2xl font-semibold tabular-nums">{summary[f.value]}</span>
                <span className="block text-sm text-muted-foreground">{f.label}</span>
              </button>
            ))}
          </div>
          <details className="mt-3 max-w-3xl text-sm">
            <summary className="cursor-pointer text-muted-foreground">What these counts mean</summary>
            <dl className="mt-2 grid gap-1">
              {FILTERS.map((f) => (
                <div key={f.value}><dt className="inline font-medium">{f.label}:</dt> <dd className="inline text-muted-foreground">{f.definition}</dd></div>
              ))}
            </dl>
          </details>
          {shown.length ? (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-normal">Student</th>
                    <th scope="col" className="py-2 pr-4 font-normal">Assignment</th>
                    <th scope="col" className="py-2 pr-4 font-normal">Status</th>
                    <th scope="col" className="py-2 pr-4 font-normal">Attempts</th>
                    <th scope="col" className="py-2 pr-4 font-normal">Last activity</th>
                    <th scope="col" className="py-2 pr-4 font-normal">Review</th>
                    <th scope="col" className="py-2 font-normal"><span className="sr-only">Evidence</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={`${row.student_id}:${row.assignment_id}`} className="border-b border-border">
                      <td className="py-3 pr-4 font-medium">{row.student_name}</td>
                      <td className="py-3 pr-4">{row.assignment_title}</td>
                      <td className="py-3 pr-4">{STATE_LABEL[row.state]}
                        {row.state === "in_progress" && row.question_budget ? ` · ${row.answered} of ${row.question_budget}` : ""}</td>
                      <td className="py-3 pr-4 tabular-nums">{row.attempts}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{when(row.last_activity)}</td>
                      <td className="py-3 pr-4">{row.review_status ? REVIEW_LABEL[row.review_status] : row.state === "completed" ? "Not reviewed" : "—"}</td>
                      <td className="py-3">
                        {row.session_id ? (
                          <Link href={`/teacher/sessions/${row.session_id}`} className="text-foreground underline underline-offset-4 hover:text-accent"
                            aria-label={`Evidence for ${row.student_name}, ${row.assignment_title}`}>Evidence</Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-6 text-muted-foreground">Nothing matches this filter.</p>
          )}
        </>
      )}
    </section>
  );
}
