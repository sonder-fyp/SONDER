/**
 * The identity of a *side* of a 1:1 conversation — not a login role. It
 * decides which bubbles render as "mine" and which canned reply comes back.
 */
export type ChatRole = "teacher" | "student" | "parent";

export type ChatMessage = {
  id: string;
  from: ChatRole;
  text: string;
  /** Display-only, e.g. "9:04 AM", "Mon 8:30 AM", "Yesterday". Never parsed, compared, or sorted. */
  at: string;
};

export type ThreadKind = "student" | "parent";

export type DirectThread = {
  /** Unique across all threads. A student thread's id is the student's id; a
   *  parent thread's id is "parent-" + the student's id — this convention is
   *  load-bearing (the class roster builds parent-thread links by string
   *  concatenation, without looking the thread up first). */
  id: string;
  kind: ThreadKind;
  /** The student the thread concerns. For a parent thread this is the child, not the guardian. */
  studentId: string;
  /** The inbox display string, e.g. "Zara Qureshi" or "Parent of Zara Qureshi". */
  label: string;
  /** Chronological, oldest first. Must be non-empty. */
  messages: ChatMessage[];
};

export type Announcement = {
  id: string;
  /** Matches a ClassRoom's `name`, not its `id`. */
  className: string;
  title: string;
  body: string;
  /** Display-only, as ChatMessage.at. */
  at: string;
};
