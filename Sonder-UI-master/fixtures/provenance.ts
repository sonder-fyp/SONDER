/**
 * Generation provenance log (Feature 19): every AI-generated question or
 * suggestion, tagged with when it was created, what generated it, and who
 * validated it — so its origin is always traceable.
 */

export type ProvenanceEntry = {
  id: string;
  kind: "question" | "distractor-set" | "consultant-suggestion" | "generation-run";
  subject: string;
  createdOn: string;
  generatedBy: string;
  purpose: string;
  status: "in-bank" | "in-review" | "rejected" | "surfaced";
  validators: string[];
  note?: string;
};

export const PROVENANCE_LOG: ProvenanceEntry[] = [
  {
    id: "gen-run-0912",
    kind: "generation-run",
    subject: "Mathematics",
    createdOn: "4 Sep 2026",
    generatedBy: "Question drafter v0.5 + Item-quality scorer v0.2 (pass mark 0.72)",
    purpose: "Add coverage for M4 'reads a digit one place too far right' — the bank held only 2 items.",
    status: "in-review",
    validators: ["— awaiting content review"],
    note: "4 rounds · 12 drafted · 8 passed the scorer · batch sent to content review.",
  },
  {
    id: "gen-2026-0834",
    kind: "question",
    subject: "Chemistry",
    createdOn: "28 Aug 2026",
    generatedBy: "Question generator v0.4 · moles template",
    purpose: "Separate 'ignores coefficients' (M2) from 'inverts the ratio' (M3).",
    status: "in-review",
    validators: ["Imran Shah", "Ayesha Siddiqui"],
    note: "Both approve the question; one distractor label under adjudication.",
  },
  {
    id: "gen-2026-0791",
    kind: "distractor-set",
    subject: "Mathematics",
    createdOn: "12 Aug 2026",
    generatedBy: "Distractor engine v0.3 · computed from question values",
    purpose: "Four options for 'round 27.48 to the nearest whole number'.",
    status: "in-bank",
    validators: ["Imran Shah", "Ayesha Siddiqui"],
    note: "Distractor values checked against the arithmetic. Closed the (M2, M4) rounding gap.",
  },
  {
    id: "gen-2026-0806",
    kind: "question",
    subject: "Physics",
    createdOn: "19 Aug 2026",
    generatedBy: "Question generator v0.4 · energy template",
    purpose: "Separate 'linear in speed' (M1) from 'confuses with momentum' (M2).",
    status: "rejected",
    validators: ["Imran Shah"],
    note: "Rejected: the generated question still gave both misconceptions the same answer.",
  },
  {
    id: "sug-2026-1180",
    kind: "consultant-suggestion",
    subject: "Chemistry",
    createdOn: "2 Sep 2026",
    generatedBy: "AI Consultant · escalation support",
    purpose: "Proposed explanations for Hina Raza's escalated moles session.",
    status: "surfaced",
    validators: ["— shown to Imran Shah, not yet actioned"],
    note: "Surfaced into the escalation queue as a labelled suggestion. No diagnosis made.",
  },
];
