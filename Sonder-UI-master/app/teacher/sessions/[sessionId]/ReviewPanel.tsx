"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { teacherClient, TeacherError } from "@/lib/teacher/client";
import { REVIEW_NOTE_MAX, type Review, type ReviewStatus } from "@/lib/teacher/reviews";

const STATUS_LABEL: Record<ReviewStatus, string> = { reviewed: "Reviewed", follow_up_required: "Follow-up required" };
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Review and follow-up for one finished check (I2-A14). Every save appends a revision. */
export function ReviewPanel({ sessionId, finished }: { sessionId: string; finished: boolean }) {
  const [reviews, setReviews] = useState<Review[]>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<ReviewStatus>("reviewed");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; alert: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // One request key per intended save: a retry after a lost reply reuses it, so it cannot write twice.
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    teacherClient.reviews(sessionId)
      .then((value) => { if (active) { setReviews(value); setLoadFailed(false); } })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [sessionId, attempt]);

  const latest = reviews?.at(-1);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !reviews) return;
    setBusy(true);
    setMessage(null);
    pendingKey.current ??= crypto.randomUUID();
    try {
      const updated = await teacherClient.addReview(sessionId, {
        expected_revision: latest?.revision ?? 0, status, note, request_key: pendingKey.current,
      });
      pendingKey.current = null;
      setReviews(updated);
      setNote("");
      setMessage({ text: "Saved.", alert: false });
    } catch (cause) {
      const code = cause instanceof TeacherError ? cause.code : "service_unavailable";
      if (code === "review_conflict") {
        pendingKey.current = null;
        setAttempt((n) => n + 1);
        setMessage({ text: "Someone else updated this review. The latest is shown; save again if you still want to change it.", alert: true });
      } else {
        setMessage({ text: code === "review_note_invalid" ? `Keep the note to ${REVIEW_NOTE_MAX} characters.`
          : "We couldn't save the review. Try again; it will not be saved twice.", alert: true });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="review" className="border-t border-border py-10">
      <h2 id="review" className="text-xl font-semibold tracking-tight">Your review</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Record that you looked at this check and whether the student needs follow-up. Reviewed is not approval for
        release: the result above is unchanged and the student does not see your review.
      </p>
      {!finished ? (
        <p className="mt-6 text-muted-foreground">The check is not finished yet, so it cannot be reviewed.</p>
      ) : loadFailed ? (
        <div role="alert" className="mt-6 border-l-2 border-attention py-3 pl-6">
          <p className="text-muted-foreground">We could not load the review.</p>
          <Button className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Retry</Button>
        </div>
      ) : !reviews ? (
        <p role="status" className="mt-6 text-muted-foreground">Loading the review…</p>
      ) : (
        <>
          <p className="mt-6">
            <span className="label text-muted-foreground">Status</span>{" "}
            <span className="font-medium">{latest ? STATUS_LABEL[latest.status] : "Not reviewed yet"}</span>
          </p>
          <form className="mt-6 grid max-w-xl gap-5" onSubmit={(event) => void save(event)}>
            <fieldset className="grid gap-3">
              <legend className="label mb-2">Mark as</legend>
              {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((value) => (
                <label key={value} className="flex items-center gap-3">
                  <input type="radio" name="review-status" value={value} checked={status === value}
                    onChange={() => { setStatus(value); pendingKey.current = null; }} className="accent-[var(--accent)]" />
                  {STATUS_LABEL[value]}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-2">
              <label className="label" htmlFor="review-note">Note (optional)</label>
              <Textarea id="review-note" maxLength={REVIEW_NOTE_MAX} value={note}
                onChange={(event) => { setNote(event.target.value); pendingKey.current = null; }} />
            </div>
            {message ? <p role={message.alert ? "alert" : "status"} className={`text-sm ${message.alert ? "text-attention" : "text-muted-foreground"}`}>{message.text}</p> : null}
            <div><Button type="submit" size="lg" disabled={busy}>{busy ? "Saving…" : "Save review"}</Button></div>
          </form>
          {reviews.length ? (
            <ol aria-label="Review history" className="mt-8 border-t border-border">
              {[...reviews].reverse().map((review) => (
                <li key={review.revision} className="border-b border-border py-4">
                  <p className="text-sm"><span className="font-medium">{STATUS_LABEL[review.status]}</span>
                    <span className="text-muted-foreground"> · {review.reviewer_name} · {when(review.created_at)} · revision {review.revision}</span></p>
                  {review.note ? <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{review.note}</p> : null}
                </li>
              ))}
            </ol>
          ) : null}
        </>
      )}
    </section>
  );
}
