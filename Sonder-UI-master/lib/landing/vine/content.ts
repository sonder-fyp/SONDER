/**
 * Copy for each node along the vine.
 *
 * Real product copy for the Sonder landing narrative. The vine measures the
 * rendered cards and rebuilds itself around whatever length the copy turns out
 * to be. Product entry is through a single account entrance; meta is a
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
    eyebrow: "Start with an answer",
    title: "Make room for your thinking",
    body: "Choose an available Mathematics topic and answer one question at a time. There is no timer and no grade to chase. Take a moment to think before choosing an answer.",
    meta: "Work at your own pace",
  },
  {
    id: "engine",
    eyebrow: "A useful next question",
    title: "Your answers guide the check",
    body: "Sonder compares possible explanations for an answer and chooses a useful next question. The check adapts as you work through it.",
    meta: "Adaptive diagnostics",
  },
  {
    id: "evidence",
    eyebrow: "Pick up later",
    title: "Keep the work you have done",
    body: "Submitted answers are saved. Return to the same topic to continue an unfinished check, even after closing the page, whenever you are ready.",
    meta: "Saved progress",
  },
  {
    id: "gate",
    eyebrow: "An honest outcome",
    title: "Uncertainty deserves a clear answer",
    body: "A diagnostic may finish without enough evidence for a specific explanation. Sonder keeps that uncertainty rather than presenting a guess as a conclusion.",
    meta: "Clarity over certainty",
  },
  {
    id: "loop",
    eyebrow: "Support for educators",
    title: "The answer is a starting point",
    body: "Class, assignment and evidence-review tools are being prepared to help teachers connect student work with thoughtful follow-up. Access will open as these tools become available.",
    meta: "Teacher tools in preparation",
  },
  {
    id: "return",
    eyebrow: "A considered next step",
    title: "Learning continues beyond a check",
    body: "Study resources, follow-up checks and parent summaries are planned around the same principle: useful support tied to the right person and the right context.",
    meta: "Further learning tools in preparation",
  },
];
