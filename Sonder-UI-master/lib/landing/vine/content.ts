/**
 * Copy for each node along the vine.
 *
 * Real product copy for the Sonder landing narrative. The vine measures the
 * rendered cards and rebuilds itself around whatever length the copy turns out
 * to be. Product entry is through the navbar workspace links only; meta is a
 * plain dim line, not a link.
 *
 * Guidance:
 *  - `eyebrow`  2-4 words, shown uppercase and letter-spaced. Keep it short.
 *  - `title`    up to ~7 words. It sets the card's height, so avoid essays.
 *  - `body`     1-3 sentences, ~150-320 characters. Longer is tolerated; the
 *               vine will simply stretch.
 *  - `meta`     short dim line under a hairline rule.
 */

export type VineNode = {
  /** Stable id — used as the React key and the card's DOM id. */
  id: string;
  /** Short kicker above the title. */
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
};

export const VINE_NODES: VineNode[] = [
  {
    id: "problem",
    eyebrow: "The problem",
    title: "A wrong answer is not a diagnosis",
    body: "Marking tells a teacher that a student got it wrong. It does not tell them why. The same wrong answer can come from four different broken ideas, and each one needs a different fix.",
    meta: "Start a diagnostic",
  },
  {
    id: "engine",
    eyebrow: "The engine",
    title: "It asks until it can tell two ideas apart",
    body: "Sonder holds a set of competing misconceptions and a probability across all of them. Every answer moves the whole set, and the next question is chosen for one job: to separate the two that are still level.",
    meta: "Watch the posterior move",
  },
  {
    id: "evidence",
    eyebrow: "The evidence",
    title: "Every diagnosis shows its work",
    body: "A teacher does not receive a score. They receive the question that was asked, the answer that was given, the engine's reason for asking it, and the confidence across every hypothesis at every step.",
    meta: "See what a teacher receives",
  },
  {
    id: "gate",
    eyebrow: "The gate",
    title: "Nothing reaches a child unreviewed",
    body: "No student and no parent sees a result a teacher has not approved. When the engine cannot separate two explanations it says so and escalates. An honest \u201Cunsure\u201D is a first-class outcome, never dressed up as a result.",
    meta: "See what a parent sees",
  },
  {
    id: "loop",
    eyebrow: "The loop",
    title: "When the bank falls short, it writes new questions",
    body: "A pair of misconceptions that no existing question can distinguish is a coverage gap. Sonder drafts candidates, scores them, discards the weak ones automatically, and sends only what survives to two independent human reviewers.",
    meta: "See a coverage gap",
  },
  {
    id: "return",
    eyebrow: "The return",
    title: "A fix only counts if it holds",
    body: "Days after a study note is read, one question comes back to check the misconception has not returned. If it has, the case reopens where it left off instead of starting from nothing.",
    meta: "Take a follow-up check",
  },
];
