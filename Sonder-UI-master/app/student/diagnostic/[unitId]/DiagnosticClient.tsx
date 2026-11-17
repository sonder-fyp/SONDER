"use client";

import Link from "next/link";
import { FocusFrame } from "@/components/layout";
import { Label, AccentBar } from "@/components/type";
import { Button, buttonVariants } from "@/components/ui/button";
import { answersSaved } from "@/lib/diagnostic/copy";
import { useDiagnosticSession } from "@/lib/diagnostic/useDiagnosticSession";

// What the student is told for each error, and whether Retry can help.
function errorView(code: string): { message: string; retry: boolean } {
  switch (code) {
    case "enrolment_required":
      return {
        message:
          "You need to be in a Maths class to take this check. Join your class under Classes with the code from your teacher.",
        retry: false,
      };
    case "enrolment_ambiguous":
      return {
        message:
          "You are in more than one Maths class. Ask your teacher which class to use.",
        retry: false,
      };
    case "assignment_not_found":
      return {
        message:
          "This assignment is not available. Return to Diagnostics or ask your teacher.",
        retry: false,
      };
    case "assignment_closed":
      return {
        message:
          "Your teacher has closed this assignment, so it cannot be started now.",
        retry: false,
      };
    case "assignment_unavailable":
      return {
        message:
          "This assignment uses a version of the check that is no longer offered. Ask your teacher to assign it again.",
        retry: false,
      };
    case "attempt_in_progress":
      return {
        message:
          "You already have this assignment in progress. Go back to it and choose Continue to pick up where you left off.",
        retry: false,
      };
    case "attempt_limit_reached":
      return {
        message:
          "You have already done this assignment. It allows one attempt.",
        retry: false,
      };
    case "authentication_required":
      return {
        message:
          "Your sign-in has ended. Sign in again to continue; your answers so far are saved.",
        retry: false,
      };
    case "role_required":
      return {
        message: "This check is only for student accounts.",
        retry: false,
      };
    case "storage_unavailable":
      return {
        message:
          "Sonder cannot save answers right now. Your earlier answers are safe. Try again in a moment.",
        retry: true,
      };
    case "storage_error":
    case "engine_numeric_error":
      return {
        message:
          "Something went wrong while saving this answer. Try once more.",
        retry: true,
      };
    case "replay_mismatch":
      return {
        message:
          "This check cannot be continued. Your saved answers are kept for your teacher.",
        retry: false,
      };
    case "session_unavailable":
    case "session_expired":
    case "unit_not_found":
      return {
        message: "This check is unavailable. You can start a fresh check.",
        retry: false,
      };
    case "answer_conflict":
    case "step_conflict":
    case "item_conflict":
    case "session_finished":
      return {
        message:
          "This check moved on in another tab or window. Retry to load where it is now.",
        retry: true,
      };
    case "capacity_exceeded":
      return {
        message: "Sonder is busy right now. Please try again in a moment.",
        retry: true,
      };
    case "invalid_origin":
      return {
        message:
          "This check cannot be started from this web address. Open Sonder from its usual address.",
        retry: false,
      };
    default:
      return {
        message:
          "We could not reach your check. Retry to recover your latest answer.",
        retry: true,
      };
  }
}

export function DiagnosticClient({
  unitId,
  initialSession,
  assignmentId,
}: {
  unitId: string;
  initialSession?: string;
  assignmentId?: string;
}) {
  const session = useDiagnosticSession(unitId, initialSession, assignmentId);
  const snapshot = session.snapshot;
  const unit = session.catalogue?.units.find((u) => u.unit_id === unitId);
  const budget =
    snapshot?.question_budget ?? session.catalogue?.question_budget;
  const working =
    ["loading_metadata", "starting", "submitting"].includes(session.phase) ||
    (session.phase === "recovering" && !session.error);
  const question =
    snapshot?.status === "in_progress" ? snapshot.question : undefined;
  return (
    <FocusFrame exitHref="/student/start" exitLabel="Back to diagnostics">
      <Label tone="accent">Topic diagnostic</Label>
      {session.phase === "complete" ? (
        <>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight">
            Session complete
          </h1>
          <p className="mt-6 text-xl">{snapshot?.unit.name}</p>
          <p className="mt-10 text-lg">
            Your submitted answers are saved. You can return to your dashboard
            when you are ready.
          </p>
          <div className="mt-12 flex flex-wrap gap-8">
            <Link href="/student" className={buttonVariants()}>
              Back to home
            </Link>
            <Button variant="ghost" onClick={session.restart}>
              Run again
            </Button>
          </div>
        </>
      ) : (
        <>
          <h1
            className={
              question
                ? "mt-6 text-xl font-semibold tracking-tight sm:text-2xl"
                : "mt-6 text-3xl font-semibold tracking-tight sm:text-4xl"
            }
          >
            {snapshot?.unit.name ?? unit?.name ?? "Mathematics diagnostic"}
          </h1>
          <AccentBar className="mt-8" />
          {session.phase === "intro" || session.phase === "starting" ? (
            <>
              <p className="mt-10 text-lg leading-relaxed text-muted-foreground">
                You will get one question at a time, up to {budget}. Answer as
                best you can. There is no time limit and no score at the end.
              </p>
              {session.unfinished ? (
                <>
                  <p className="mt-6">
                    You have an unfinished check on this topic (
                    {answersSaved(session.unfinished.answered_count)}).
                  </p>
                  <Button
                    size="lg"
                    className="mt-12 w-full"
                    disabled={working}
                    onClick={session.resume}
                  >
                    Continue
                  </Button>
                </>
              ) : (
                <Button
                  size="lg"
                  className="mt-12 w-full"
                  disabled={working}
                  onClick={session.begin}
                >
                  Begin
                </Button>
              )}
            </>
          ) : null}
          {question ? (
            <>
              <Label tone="muted" className="mt-10">
                Question {question.step_index + 1}
              </Label>
              <p className="mt-3 text-sm text-muted-foreground">
                {answersSaved(snapshot?.answered_count ?? 0)} · up to {budget}{" "}
                questions
              </p>
              <h2 className="mt-4 text-2xl font-semibold leading-snug sm:text-3xl">
                {question.stem}
              </h2>
              <div className="mt-8 border-t border-border">
                {question.options.map((option) => (
                  <button
                    key={option.option_id}
                    type="button"
                    aria-label={`${option.option_id}. ${option.text}`}
                    disabled={session.phase !== "question"}
                    onClick={() => session.answer(option.option_id)}
                    aria-pressed={session.chosen === option.option_id}
                    className="flex min-h-16 w-full items-center gap-6 border-b border-border px-2 py-5 text-left text-lg hover:bg-muted disabled:opacity-60"
                  >
                    <span className="label nums w-6 shrink-0">
                      {option.option_id}
                    </span>
                    {option.text}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {working ? (
            <p role="status" className="mt-10 text-muted-foreground">
              {session.phase === "submitting"
                ? "Saving your answer…"
                : "Loading your check"}
            </p>
          ) : null}
          {session.error ? (
            <div role="alert" className="mt-10">
              <p>{errorView(session.error).message}</p>
              <div className="mt-6 flex flex-wrap gap-6">
                {session.error === "authentication_required" ? (
                  <Link
                    href={`/auth/sign-in?next=${encodeURIComponent(typeof window === "undefined" ? `/student/diagnostic/${encodeURIComponent(unitId)}` : window.location.pathname + window.location.search)}`}
                    className={buttonVariants()}
                  >
                    Sign in
                  </Link>
                ) : null}
                {errorView(session.error).retry ? (
                  <Button onClick={session.retry}>Retry</Button>
                ) : null}
                <Button variant="ghost" onClick={session.restart}>
                  Start a fresh check
                </Button>
                <Link
                  href="/student/start"
                  className={buttonVariants({ variant: "ghost" })}
                >
                  Back to topics
                </Link>
              </div>
            </div>
          ) : null}
        </>
      )}
    </FocusFrame>
  );
}
