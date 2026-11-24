import type { Evidence } from "./evidence";

/** Shown wherever a probability is shown (requirements §1.6). */
export const CONFIDENCE_NOTE = "Model confidence under assumed parameters — not measured accuracy.";

/** reason is the engine's own stored explanation of a refusal (escalation.reason), shown as written. */
export type OutcomeSummary = { label: string; detail: string; tone: "result" | "refusal" | "open"; reason: string | null };

const names = (evidence: Evidence, slots: number[]) =>
  slots.map((slot) => evidence.hypotheses.find((h) => h.slot === slot)?.name ?? `Hypothesis ${slot}`);

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** The session's outcome in plain words, from stored evidence only. */
export function describeOutcome(evidence: Evidence): OutcomeSummary {
  const o = evidence.outcome;
  const ranked = (pairs: [number, number][]) => [...pairs].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
  const answered = evidence.steps.length;
  switch (o.outcome) {
    case "diagnosed": {
      // Rank 1 is the diagnosis; rank 2 is only the runner-up the engine stores beside it
      // (sonder_engine/trace.py). Naming both in the label would read as two diagnoses.
      const [diagnosis, runnerUp] = ranked(o.diagnosis_candidates);
      const [name] = names(evidence, diagnosis === undefined ? [] : [diagnosis]);
      const last = evidence.steps[evidence.steps.length - 1]?.posterior;
      const next = runnerUp === undefined ? "" : ` Next most likely: ${names(evidence, [runnerUp])[0]}` +
        (last && last[runnerUp] !== undefined ? ` (${percent(last[runnerUp])}).` : ".");
      return { label: `Diagnosed: ${name ?? "unknown"}`, tone: "result", reason: null,
        detail: `The model's confidence reached its threshold after ${answered} answers.${next}` };
    }
    case "none_detected":
      return { label: "No misconception detected", tone: "result", reason: null,
        detail: `After ${answered} answers the model is confident the student has none of the modelled misconceptions.` };
    case "escalated_no_separator": {
      const tied = names(evidence, ranked(o.escalation_candidates));
      return { label: "Not diagnosed: the remaining questions cannot tell these apart", tone: "refusal",
        reason: o.escalation_reason, detail: `${list(tied)} stay tied, and no question left can separate them.` };
    }
    case "escalated_exhausted":
      return { label: "Not diagnosed: question budget used up", tone: "refusal", reason: o.escalation_reason,
        detail: `All ${evidence.question_budget} questions were used before any explanation was clear enough.` };
    case "escalated_unmodelled":
      return { label: "Not diagnosed: the answers fit none of the modelled explanations", tone: "refusal",
        reason: o.escalation_reason, detail: `"Something else" became the most likely explanation.` };
    case "abandoned":
      return { label: "Abandoned", tone: "open", reason: null, detail: `Stopped after ${answered} answers.` };
    default:
      return { label: "In progress", tone: "open", reason: null,
        detail: `${answered} of up to ${evidence.question_budget} questions answered.` };
  }
}

/** Probability as a whole-number percentage, never "100%" or "0%" unless exact. */
export function percent(p: number) {
  if (p >= 1) return "100%";
  if (p <= 0) return "0%";
  const value = Math.round(p * 100);
  if (value >= 100) return ">99%";
  if (value <= 0) return "<1%";
  return `${value}%`;
}
