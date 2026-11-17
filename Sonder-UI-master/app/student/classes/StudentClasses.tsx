"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SignInAgain } from "@/components/product/SignInAgain";
import { classesClient, ClassesError } from "@/lib/classes/client";
import type { StudentClass } from "@/lib/classes/types";

const errorCode = (cause: unknown) => (cause instanceof ClassesError ? cause.code : "service_unavailable");

function JoinForm({ onJoined }: { onJoined: (room: StudentClass, joined: boolean) => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await classesClient.joinClass(code);
      setCode("");
      onJoined(result.class, result.joined);
    } catch (cause) {
      const failure = errorCode(cause);
      setError(failure === "join_code_invalid"
        ? "That code does not match an open class. Check it with your teacher."
        : failure === "authentication_required"
          ? "Your session has ended. Sign in again to join a class."
          : "We couldn't join the class. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="join-class" className="border-t border-border py-10">
      <h2 id="join-class" className="text-2xl font-semibold tracking-tight">Join a class</h2>
      <p className="mt-3 max-w-xl text-muted-foreground">Enter the code your teacher gave you.</p>
      <form className="mt-8 grid max-w-md gap-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-2">
          <label className="label" htmlFor="join-code">Class code</label>
          <Input id="join-code" required maxLength={64} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            className="font-mono uppercase tracking-[0.2em]" value={code} onChange={(event) => setCode(event.target.value)} />
        </div>
        {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}
        <div><Button type="submit" size="lg" disabled={busy}>{busy ? "Joining…" : "Join class"}</Button></div>
      </form>
    </section>
  );
}

export function StudentClasses() {
  const [classes, setClasses] = useState<StudentClass[]>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    classesClient.studentClasses()
      .then((value) => { if (active) setClasses(value); })
      .catch((cause) => { if (active) setError(errorCode(cause)); });
    return () => { active = false; };
  }, [attempt]);

  function joined(room: StudentClass, isNew: boolean) {
    setClasses((list) => [room, ...(list ?? []).filter((entry) => entry.class_id !== room.class_id)]);
    setNotice(isNew ? `You joined ${room.name}.` : `You are already in ${room.name}.`);
  }

  if (error === "authentication_required") return <SignInAgain returnTo="/student/classes" />;
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
      <section className="py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Your classes</h2>
        {classes.length ? (
          <ul className="mt-6 border-t border-border">
            {classes.map((room) => (
              <li key={room.class_id} className="border-b border-border px-2 py-6">
                <h3 className="text-xl font-semibold tracking-tight">{room.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Mathematics · Grade {room.grade_level}{room.teacher_names ? ` · ${room.teacher_names}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-lg text-muted-foreground">You have not joined a class yet.</p>
        )}
        <p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>
      </section>
      <JoinForm onJoined={joined} />
    </>
  );
}
