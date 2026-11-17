"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageMasthead } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
import { SignInAgain } from "@/components/product/SignInAgain";
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { RosterStudent, TeacherClass } from "@/lib/classes/types";

const code = (cause: unknown) => (cause instanceof ClassesError ? cause.code : "service_unavailable");
const joinedOn = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function BackToClasses() {
  return (
    <Link href="/teacher/classes" className={buttonVariants({ variant: "ghost" })}>
      <ArrowLeft className="size-4" aria-hidden />
      All classes
    </Link>
  );
}

/** A destructive action that asks once more, inline, before it runs. */
function ConfirmAction({ label, confirmLabel, warning, busyLabel, onConfirm }: {
  label: string; confirmLabel: string; warning: string; busyLabel: string; onConfirm: () => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) return <Button variant="ghost" onClick={() => setAsking(true)}>{label}</Button>;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <span className="text-sm text-attention">{warning}</span>
      <Button variant="outline" disabled={busy} onClick={() => {
        setBusy(true);
        void onConfirm().finally(() => { setBusy(false); setAsking(false); });
      }}>
        {busy ? busyLabel : confirmLabel}
      </Button>
      <Button variant="ghost" disabled={busy} onClick={() => setAsking(false)}>Cancel</Button>
    </div>
  );
}

function JoinCode({ room, onChange }: { room: TeacherClass; onChange: (room: TeacherClass) => void }) {
  const [message, setMessage] = useState("");
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.join_code);
      setMessage("Copied");
    } catch {
      setMessage("Copy failed. Select the code instead.");
    }
  }
  async function newCode() {
    try {
      onChange(await classesClient.newJoinCode(room.class_id));
      setMessage("New code issued. The old code no longer works.");
    } catch {
      setMessage("We couldn't issue a new code. The current code still works.");
    }
  }
  return (
    <section aria-labelledby="join-code" className="border-y border-border py-10">
      <h2 id="join-code" className="label text-muted-foreground">Join code</h2>
      {room.status === "archived" ? (
        <p className="mt-4 max-w-xl text-muted-foreground">
          This class is archived, so nobody can join it. Restore the class to accept students again.
        </p>
      ) : (
        <>
          <p className="mt-4 select-all font-mono text-4xl tracking-[0.2em] md:text-5xl">{room.join_code}</p>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Share this code with your students. They enter it under Classes to join this class.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-8">
            <Button variant="outline" onClick={() => void copyCode()}>Copy code</Button>
            <ConfirmAction label="Issue a new code" confirmLabel="Replace code" busyLabel="Replacing…"
              warning="Students who have the old code will not be able to use it." onConfirm={newCode} />
          </div>
        </>
      )}
      <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>
    </section>
  );
}

function Roster({ room }: { room: TeacherClass }) {
  const [students, setStudents] = useState<RosterStudent[]>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.roster(room.class_id)
      .then((value) => { if (active) setStudents(value); })
      .catch((cause) => { if (active) setError(code(cause)); });
    return () => { active = false; };
  }, [room.class_id, attempt]);

  async function remove(student: RosterStudent) {
    try {
      await classesClient.removeStudent(room.class_id, student.student_id);
      setStudents((list) => list?.filter((entry) => entry.student_id !== student.student_id));
      setNotice(`${student.display_name} was removed from the class.`);
    } catch (cause) {
      setNotice(code(cause) === "student_not_found"
        ? `${student.display_name} is no longer in this class.`
        : `We couldn't remove ${student.display_name}. Try again.`);
      if (code(cause) === "student_not_found") setAttempt((n) => n + 1);
    }
  }

  return (
    <section aria-labelledby="roster" className="py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="roster" className="text-2xl font-semibold tracking-tight">Students</h2>
        {students ? <p className="text-sm text-muted-foreground">{students.length} joined</p> : null}
      </div>
      {error ? (
        <div role="alert" className="border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load the students in this class.</p>
          <Button className="mt-4" onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Retry</Button>
        </div>
      ) : !students ? (
        <p role="status" className="text-muted-foreground">Loading students…</p>
      ) : !students.length ? (
        <p className="max-w-xl text-muted-foreground">No students have joined yet. Share the join code to get started.</p>
      ) : (
        <ul className="border-t border-border">
          {students.map((student) => (
            <li key={student.student_id} className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-2 py-4">
              <div>
                <p className="font-medium">{student.display_name}</p>
                <p className="text-sm text-muted-foreground">Joined {joinedOn(student.joined_at)}</p>
              </div>
              <ConfirmAction label="Remove" confirmLabel={`Remove ${student.display_name}`} busyLabel="Removing…"
                warning="They can rejoin only with the current code." onConfirm={() => remove(student)} />
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>
    </section>
  );
}

function ClassStatusControl({ room, onChange }: { room: TeacherClass; onChange: (room: TeacherClass) => void }) {
  const [error, setError] = useState("");
  const archived = room.status === "archived";
  async function change() {
    setError("");
    try {
      onChange(await classesClient.setClassStatus(room.class_id, archived ? "active" : "archived"));
    } catch {
      setError("We couldn't change the class. Nothing has changed.");
    }
  }
  return (
    <section aria-labelledby="class-status" className="border-t border-border py-10">
      <h2 id="class-status" className="text-xl font-semibold tracking-tight">{archived ? "Restore this class" : "Archive this class"}</h2>
      <p className="mt-3 max-w-xl text-muted-foreground">
        {archived
          ? "Restoring lets students join again with the current code."
          : "Archiving stops new students joining and stops diagnostics being started in this class. Its students stay listed."}
      </p>
      <div className="mt-6">
        {archived ? (
          <Button variant="outline" onClick={() => void change()}>Restore class</Button>
        ) : (
          <ConfirmAction label="Archive class" confirmLabel="Archive" busyLabel="Archiving…"
            warning="Students will not be able to start diagnostics here." onConfirm={change} />
        )}
      </div>
      {error ? <p role="alert" className="mt-4 text-sm text-attention">{error}</p> : null}
    </section>
  );
}

export function TeacherClassDetail({ classId }: { classId: string }) {
  const [room, setRoom] = useState<TeacherClass>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.teacherClass(classId)
      .then((value) => { if (active) setRoom(value); })
      .catch((cause) => { if (active) setError(code(cause)); });
    return () => { active = false; };
  }, [classId, attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo={`/teacher/classes/${classId}`} />;
  if (error === "class_not_found")
    return (
      <>
        <PageMasthead label="Teacher" title="Class not found" lede="This class does not exist or is not one of your classes." />
        <div className="py-10"><BackToClasses /></div>
      </>
    );
  if (error)
    return (
      <>
        <PageMasthead label="Teacher" title="Class details" />
        <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
          <h2 className="text-xl font-semibold">We could not load this class</h2>
          <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">Nothing has changed. Try again in a moment.</p>
          <Button className="mt-6" onClick={() => { setError(null); setAttempt(attempt + 1); }}>Retry</Button>
        </section>
      </>
    );
  if (!room)
    return (
      <>
        <PageMasthead label="Teacher" title="Class details" />
        <div role="status" className="py-10">
          <p className="text-muted-foreground">Loading class…</p>
          <div aria-hidden className="mt-6 h-24 border-y border-border bg-muted/30 motion-safe:animate-pulse" />
        </div>
      </>
    );
  return (
    <>
      <PageMasthead
        label={room.status === "archived" ? "Archived class" : "Class"}
        title={room.name}
        lede={room.note || undefined}
        meta={<p className="text-sm text-muted-foreground">Mathematics · Grade {room.grade_level}</p>}
      />
      <div className="pt-10"><JoinCode room={room} onChange={setRoom} /></div>
      <Roster room={room} />
      <ClassStatusControl room={room} onChange={setRoom} />
      <BackToClasses />
    </>
  );
}
