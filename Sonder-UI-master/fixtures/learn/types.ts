import type { Subject } from "@/fixtures/scenarios/types";

export type WorkedExample = {
  prompt: string;
  wrongMove: string;
  rightMove: string;
  answer: string;
};

export type LearnResource = {
  title: string;
  source: string; // "YouTube · Khan Academy", "BBC Bitesize", "Article · Math is Fun"
  kind: "video" | "article" | "interactive";
  url: string; // a real, working URL
  rationale: string; // one line: why this one was picked
  relevance: number; // 0–1, drives the chip + the sort order
};

export type ChatEntry = {
  /** "simpler" and "harder" are reserved ids — the persistent buttons resolve to them. */
  id: string;
  label: string; // suggested-question chip label
  question: string; // full text added to the transcript when asked
  answer: string;
  example?: WorkedExample;
  followups?: string[]; // ids of suggested next entries
};

export type LearnConceptChat = {
  greeting: string;
  entries: ChatEntry[]; // must include ids "simpler" and "harder"
  fallback: string;
};

export type LearnPage = {
  subject: Subject;
  code: string; // catalogue code, e.g. "M4"
  title: string;
  whatItIs: string;
  howToThink: string;
  example: WorkedExample;
  searchQuery: string; // shown in "Searching the web for '…'"
  resources: LearnResource[]; // 3–4, pre-sorted by relevance desc
  chat: LearnConceptChat;
};
