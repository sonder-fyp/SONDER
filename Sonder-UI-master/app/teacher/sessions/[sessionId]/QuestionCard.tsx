import { Check } from "lucide-react";
import type { Evidence, EvidenceQuestion, EvidenceStep } from "@/lib/teacher/evidence";
import { percent } from "@/lib/teacher/describe";

/** Probability of every hypothesis after one answer: a meter list (name, bar, figure), slot order kept. */
export function PosteriorMeters({ evidence, step }: { evidence: Evidence; step: EvidenceStep }) {
  return (
    <figure className="mt-6">
      <figcaption className="label text-muted-foreground">Model confidence after this answer</figcaption>
      <ul className="mt-3 grid gap-2">
        {evidence.hypotheses.map((hypothesis) => {
          const p = step.posterior[hypothesis.slot] ?? 0;
          return (
            <li key={hypothesis.slot} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 md:grid-cols-[minmax(0,16rem)_1fr_4rem]">
              <span className="truncate text-sm" title={hypothesis.name}>{hypothesis.name}</span>
              <span className="text-right text-sm tabular-nums text-muted-foreground md:order-3">{percent(p)}</span>
              <span aria-hidden className="col-span-2 h-2 bg-muted md:order-2 md:col-span-1">
                <span className="block h-2 rounded-r-[4px] bg-accent" style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%` }} />
              </span>
              <span className="sr-only">
                {`${hypothesis.name}: ${percent(p)}, supported by ${step.support[hypothesis.slot] ?? 0} answers`}
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export function QuestionCard({ evidence, question, step, number }: {
  evidence: Evidence; question: EvidenceQuestion; step: EvidenceStep | undefined; number: number;
}) {
  const runnerUp = question.candidates.find((candidate) => candidate.item_id !== question.item_id);
  return (
    <li className="border-t border-border py-8">
      <p className="label text-muted-foreground">Question {number} · {question.item_id}{step ? "" : " · waiting for an answer"}</p>
      <h3 className="mt-3 max-w-3xl text-xl font-semibold leading-snug tracking-tight">{question.stem}</h3>
      <ul className="mt-5 grid max-w-3xl gap-2">
        {question.options.map((option) => {
          const chosen = step?.option_id === option.option_id;
          return (
            <li key={option.option_id}
              className={`border px-4 py-3 ${chosen ? "border-accent bg-muted" : "border-border"}`}
              aria-label={`Option ${option.option_id}${chosen ? ", chosen by the student" : ""}${option.is_correct ? ", correct answer" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="label text-muted-foreground">{option.option_id}</span>
                <span className="font-medium">{option.text}</span>
                {option.is_correct ? (
                  <span className="inline-flex items-center gap-1 text-sm text-accent"><Check className="size-4" aria-hidden />Correct</span>
                ) : null}
                {chosen ? <span className="label text-foreground">Chosen</span> : null}
              </div>
              {option.links.length ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Linked to{" "}
                  {option.links.map((link, index) => (
                    <span key={link.misconception_id}>
                      {index ? "; " : ""}
                      <span className="text-foreground">{link.name}</span> ({link.misconception_id}
                      {link.grade === "T" ? ", stretch link" : ""})
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {step ? <p className="mt-4 max-w-3xl text-sm text-muted-foreground">{step.answer_note}</p> : null}
      <details className="mt-4 max-w-3xl">
        <summary className="cursor-pointer text-sm text-foreground">Why this question was asked</summary>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.selection_reason}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Expected information gain {question.expected_ig.toFixed(3)} bits
          {runnerUp ? `; next best ${runnerUp.item_id} at ${runnerUp.eig.toFixed(3)} bits` : ""}.
        </p>
      </details>
      {step ? <PosteriorMeters evidence={evidence} step={step} /> : null}
    </li>
  );
}
