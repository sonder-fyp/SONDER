"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { classesClient, ClassesError } from "@/lib/classes/client";
import { ASSIGNMENT_TITLE_MAX } from "@/lib/classes/validation";
import type { AssignableUnit, AttemptRule, TeacherAssignment, TeacherClass } from "@/lib/classes/types";

const errorCode = (cause: unknown) => (cause instanceof ClassesError ? cause.code : "service_unavailable");
const RULES: { value: AttemptRule; label: string; help: string }[] = [
  { value: "single", label: "One attempt", help: "Each student takes it once. An unfinished attempt is resumed." },
  { value: "repeat", label: "Repeat attempts", help: "A student may start again after finishing." },
];
const ASSIGN_ERRORS: Record<string, string> = {
  assignment_title_invalid: `Enter a title of up to ${ASSIGNMENT_TITLE_MAX} characters.`,
  unit_not_found: "That topic is not available on this server any more. Choose another.",
  class_archived: "This class is archived. Restore it before assigning work.",
  assignments_unavailable: "Diagnostics are not running on this server, so work cannot be assigned right now.",
  engine_unavailable: "Diagnostics are not reachable right now, so work cannot be assigned. Try again in a moment.",
};

function AssignForm({ classId, onCreated }: { classId: string; onCreated: (item: TeacherAssignment) => void }) {
  const [units, setUnits] = useState<AssignableUnit[]>();
  const [unitsFailed, setUnitsFailed] = useState(false);
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [rule, setRule] = useState<AttemptRule>("single");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.teacherUnits()
      .then((value) => { if (active) { setUnits(value); setUnitsFailed(false); } })
      .catch(() => { if (active) setUnitsFailed(true); });
    return () => { active = false; };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      onCreated(await classesClient.createAssignment(classId, { unit_id: unitId, title, attempt_rule: rule }));
      setUnitId("");
      setTitle("");
      setRule("single");
    } catch (cause) {
      setError(ASSIGN_ERRORS[errorCode(cause)] ?? "We couldn't assign this. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  if (unitsFailed)
    return (
      <div role="alert" className="mt-8 border-l-2 border-attention py-3 pl-6">
        <p className="text-muted-foreground">We could not load the available topics, so work cannot be assigned yet.</p>
        <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
      </div>
    );
  if (!units) return <p role="status" className="mt-8 text-muted-foreground">Loading topics…</p>;
  return (
    <form aria-labelledby="assign-work" className="mt-8 grid max-w-xl gap-5" onSubmit={(event) => void submit(event)}>
      <h3 id="assign-work" className="text-xl font-semibold tracking-tight">Assign a topic</h3>
      <div className="grid gap-2">
        <label className="label" htmlFor="assign-unit">Topic</label>
        <select id="assign-unit" required value={unitId}
          className="h-12 w-full border border-border-strong bg-input px-4 text-base text-foreground focus:border-accent md:h-14"
          onChange={(event) => {
            const next = event.target.value;
            if (!title.trim()) setTitle(units.find((unit) => unit.unit_id === next)?.name ?? "");
            setUnitId(next);
          }}>
          <option value="" disabled>Choose a topic</option>
          {units.map((unit) => <option key={unit.unit_id} value={unit.unit_id}>{unit.name}</option>)}
        </select>
      </div>
      <div className="grid gap-2">
        <label className="label" htmlFor="assign-title">Title</label>
        <Input id="assign-title" required maxLength={ASSIGNMENT_TITLE_MAX} value={title} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <fieldset className="grid gap-3">
        <legend className="label mb-2">Attempts</legend>
        {RULES.map((option) => (
          <label key={option.value} className="flex items-start gap-3">
            <input type="radio" name="attempt-rule" value={option.value} checked={rule === option.value}
              onChange={() => setRule(option.value)} className="mt-1.5 accent-[var(--accent)]" />
            <span><span className="font-medium">{option.label}</span><span className="block text-sm text-muted-foreground">{option.help}</span></span>
          </label>
        ))}
      </fieldset>
      {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}
      <div><Button type="submit" size="lg" disabled={busy || !unitId}>{busy ? "Assigning…" : "Assign"}</Button></div>
    </form>
  );
}

export function ClassAssignments({ room }: { room: TeacherClass }) {
  const [items, setItems] = useState<TeacherAssignment[]>();
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.assignments(room.class_id)
      .then((value) => { if (active) { setItems(value); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [room.class_id, attempt]);

  async function toggle(item: TeacherAssignment) {
    const next = item.status === "open" ? "closed" : "open";
    try {
      const updated = await classesClient.setAssignmentStatus(room.class_id, item.assignment_id, next);
      setItems((list) => list?.map((entry) => (entry.assignment_id === updated.assignment_id ? updated : entry)));
      setNotice(next === "closed" ? `${item.title} is closed. Students no longer see it.` : `${item.title} is open again.`);
    } catch {
      setNotice(`We couldn't change ${item.title}. Nothing has changed.`);
    }
  }

  return (
    <section aria-labelledby="assignments" className="border-t border-border py-10">
      <h2 id="assignments" className="text-2xl font-semibold tracking-tight">Assignments</h2>
      {error ? (
        <div role="alert" className="mt-6 border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load this class&apos;s assignments.</p>
          <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </div>
      ) : !items ? (
        <p role="status" className="mt-6 text-muted-foreground">Loading assignments…</p>
      ) : !items.length ? (
        <p className="mt-4 max-w-xl text-muted-foreground">Nothing has been assigned to this class yet.</p>
      ) : (
        <ul className="mt-6 border-t border-border">
          {items.map((item) => (
            <li key={item.assignment_id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-2 py-4">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.unit_name} · {item.attempt_rule === "single" ? "One attempt" : "Repeat attempts"} · {item.status === "open" ? "Open" : "Closed"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => void toggle(item)}>{item.status === "open" ? "Close" : "Reopen"}</Button>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>
      {room.status === "archived" ? (
        <p className="mt-6 max-w-xl text-muted-foreground">Restore the class to assign more work.</p>
      ) : (
        <AssignForm classId={room.class_id} onCreated={(item) => {
          setItems((list) => [item, ...(list ?? [])]);
          setNotice(`${item.title} is assigned.`);
        }} />
      )}
    </section>
  );
}
