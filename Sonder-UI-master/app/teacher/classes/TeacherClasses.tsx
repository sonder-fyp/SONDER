"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignInAgain } from "@/components/product/SignInAgain";
import { classesClient, ClassesError } from "@/lib/classes/client";
import { CLASS_NAME_MAX, CLASS_NOTE_MAX } from "@/lib/classes/validation";
import type { TeacherClass } from "@/lib/classes/types";

const CREATE_ERRORS: Record<string, string> = {
  class_name_invalid: `Enter a class name of up to ${CLASS_NAME_MAX} characters.`,
  class_note_invalid: `Keep the note to ${CLASS_NOTE_MAX} characters or fewer.`,
  subject_missing: "Mathematics is not set up on this server yet, so classes cannot be created.",
  authentication_required: "Your session has ended. Sign in again to create a class.",
};

function errorCode(cause: unknown) {
  return cause instanceof ClassesError ? cause.code : "service_unavailable";
}

function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const created = await classesClient.createClass({ name, note });
      router.push(`/teacher/classes/${created.class_id}`);
    } catch (cause) {
      const code = errorCode(cause);
      setError(CREATE_ERRORS[code] ?? "We couldn't create the class. Try again in a moment.");
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="create-class" className="border-t border-border py-10">
      <h2 id="create-class" className="text-2xl font-semibold tracking-tight">Create a class</h2>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Each class teaches Mathematics and gets its own join code for your students.
      </p>
      <form className="mt-8 grid max-w-xl gap-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-2">
          <label className="label" htmlFor="class-name">Class name</label>
          <Input id="class-name" required maxLength={CLASS_NAME_MAX} value={name}
            onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="class-note">Note (optional)</label>
          <Textarea id="class-note" maxLength={CLASS_NOTE_MAX} value={note}
            onChange={(event) => setNote(event.target.value)} />
        </div>
        {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}
        <div>
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Creating…" : "Create class"}</Button>
        </div>
      </form>
    </section>
  );
}

function ClassList({ classes }: { classes: TeacherClass[] }) {
  if (!classes.length)
    return (
      <section className="py-10">
        <h2 className="text-2xl font-semibold">No classes yet</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">
          Create your first class below. Students join it with the code it is given.
        </p>
      </section>
    );
  return (
    <section className="py-10">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Your classes</h2>
        <p className="text-sm text-muted-foreground">
          {classes.length} {classes.length === 1 ? "class" : "classes"}
        </p>
      </div>
      <div className="border-t border-border">
        {classes.map((room) => (
          <Link key={room.class_id} href={`/teacher/classes/${room.class_id}`}
            className="group flex min-h-24 items-center justify-between gap-6 border-b border-border px-2 py-6 hover:bg-muted">
            <div>
              <h3 className="text-xl font-semibold tracking-tight">{room.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {room.student_count} {room.student_count === 1 ? "student" : "students"}
                {room.status === "archived" ? " · Archived" : ""}
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-accent transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function TeacherClasses() {
  const [classes, setClasses] = useState<TeacherClass[]>();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.teacherClasses()
      .then((value) => { if (active) setClasses(value); })
      .catch((cause) => { if (active) setError(errorCode(cause)); });
    return () => { active = false; };
  }, [attempt]);

  if (error === "authentication_required") return <SignInAgain returnTo="/teacher/classes" />;
  if (error)
    return (
      <section role="alert" className="my-10 border-l-2 border-attention py-3 pl-6">
        <h2 className="text-xl font-semibold">We could not load your classes</h2>
        <p className="mt-3 max-w-lg leading-relaxed text-muted-foreground">Nothing has changed. Try again in a moment.</p>
        <Button className="mt-6" onClick={() => { setError(null); setAttempt(attempt + 1); }}>Retry</Button>
      </section>
    );
  if (!classes)
    return (
      <div role="status" className="py-10">
        <p className="text-muted-foreground">Loading your classes…</p>
        <div aria-hidden className="mt-6 h-24 border-y border-border bg-muted/30 motion-safe:animate-pulse" />
      </div>
    );
  return (
    <>
      <ClassList classes={classes} />
      <CreateClassForm />
    </>
  );
}
