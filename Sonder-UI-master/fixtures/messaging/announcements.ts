import type { Announcement } from "./types";

/**
 * Five seed announcements, authored newest-first within each class. There is
 * no sort call anywhere this is read — "newest first" is a property of how
 * this array is authored, because `at` is an unparseable display string.
 */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "9b-moles-recap",
    className: "9-B",
    title: "Moles recap on Thursday",
    body: "We'll cover reading mole ratios from a balanced equation. Aimed at anyone whose stoichiometry session escalated, but everyone's welcome.",
    at: "2 days ago",
  },
  {
    id: "9b-followups",
    className: "9-B",
    title: "Follow-up checks going out this week",
    body: "One question, no marks — it just confirms an earlier fix held. Please do it before Friday.",
    at: "4 days ago",
  },
  {
    id: "9b-how-diagnostics-reach-me",
    className: "9-B",
    title: "How diagnostics reach me",
    body: "Every result reaches me with its full evidence first. The engine hands over rather than guessing, and nothing reaches a parent until I've reviewed it.",
    at: "1 week ago",
  },
  {
    id: "9a-rounding-digit",
    className: "9-A",
    title: "Rounding: which digit decides",
    body: "A common slip is checking a digit one place too far right. There's a study note on this in Learn if you want a refresher.",
    at: "3 days ago",
  },
  {
    id: "9a-broad-check",
    className: "9-A",
    title: "Run a broad check if a whole topic feels shaky",
    body: "You don't need an assignment for this — you can start a diagnostic yourself any time from New diagnostic.",
    at: "1 week ago",
  },
];

export function announcementsForClass(className: string): Announcement[] {
  return ANNOUNCEMENTS.filter((a) => a.className === className);
}
