export type ConsultantReply = {
  text: string;
  /** Bullet points of evidence shown under any reply that makes a claim. */
  evidence?: string[];
};

export type ConsultantPrompt = {
  id: string;
  /** Short label for the suggested-prompt chip. */
  label: string;
  /** The full question added to the transcript when the chip is used. */
  question: string;
  reply: ConsultantReply;
};

export type ConsultantConfig = {
  personaLabel: string;
  greeting: ConsultantReply;
  prompts: ConsultantPrompt[];
  fallback: ConsultantReply;
};
