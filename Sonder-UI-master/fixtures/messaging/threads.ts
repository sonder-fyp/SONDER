import type { DirectThread } from "./types";

/**
 * Five seed threads, in fixture array order — this is the teacher inbox's
 * render order; nothing here is ever sorted. Five of the nine students have
 * no thread at all, and that's deliberate (see the messaging blueprint).
 */
export const THREADS: DirectThread[] = [
  {
    id: "zara",
    kind: "student",
    studentId: "zara",
    label: "Zara Qureshi",
    messages: [
      {
        id: "zara-1",
        from: "teacher",
        text: "Quick nudge — your rounding follow-up check is due this week. One question, no marks. Try to get to it before Friday.",
        at: "Mon 8:12 AM",
      },
      {
        id: "zara-2",
        from: "student",
        text: "Is it the same kind of question as last time?",
        at: "Mon 8:30 AM",
      },
      {
        id: "zara-3",
        from: "teacher",
        text: "Same idea, different numbers. It just checks the fix held — you were checking the digit one place too far right. Worth re-reading the study note first.",
        at: "Mon 8:41 AM",
      },
      {
        id: "zara-4",
        from: "student",
        text: "Okay, I'll do it tonight.",
        at: "Mon 8:44 AM",
      },
    ],
  },
  {
    id: "parent-zara",
    kind: "parent",
    studentId: "zara",
    label: "Parent of Zara Qureshi",
    messages: [
      {
        id: "parent-zara-1",
        from: "parent",
        text: "Hi Mr Shah — is there anything Zara needs to do at home for the follow-up check this week?",
        at: "Tue 6:15 PM",
      },
      {
        id: "parent-zara-2",
        from: "teacher",
        text: "Nothing needed at home. It's one short question confirming an earlier fix held — the study note is already available to her if she wants to revisit it. I'll let you know how it goes.",
        at: "Tue 6:22 PM",
      },
      {
        id: "parent-zara-3",
        from: "parent",
        text: "Thank you for letting me know.",
        at: "Tue 6:24 PM",
      },
    ],
  },
  {
    id: "hina",
    kind: "student",
    studentId: "hina",
    label: "Hina Raza",
    messages: [
      {
        id: "hina-1",
        from: "student",
        text: "Did I get the moles question wrong? It said it couldn't decide.",
        at: "Wed 3:10 PM",
      },
      {
        id: "hina-2",
        from: "teacher",
        text: "Not wrong exactly — your answers pointed in a couple of directions at once, so the engine wouldn't guess and it came to me instead. We'll go over reading ratios from a balanced equation before you retry.",
        at: "Wed 3:15 PM",
      },
      {
        id: "hina-3",
        from: "student",
        text: "Okay, thank you Mr Shah.",
        at: "Wed 3:16 PM",
      },
    ],
  },
  {
    id: "bilal",
    kind: "student",
    studentId: "bilal",
    label: "Bilal Ahmed",
    messages: [
      {
        id: "bilal-1",
        from: "teacher",
        text: "Your kinetic-energy diagnosis is with me for review — I'll approve it today and the study note will follow.",
        at: "Thu 9:00 AM",
      },
      {
        id: "bilal-2",
        from: "student",
        text: "Thanks Mr Shah.",
        at: "Thu 9:05 AM",
      },
    ],
  },
  {
    id: "ayesha",
    kind: "student",
    studentId: "ayesha",
    label: "Ayesha Khan",
    messages: [
      {
        id: "ayesha-1",
        from: "student",
        text: "Should I run the fractions diagnostic now or wait until we've covered it in class?",
        at: "Fri 11:20 AM",
      },
      {
        id: "ayesha-2",
        from: "teacher",
        text: "Go ahead whenever a question feels shaky — no need to wait for me.",
        at: "Fri 11:24 AM",
      },
    ],
  },
];

export function getThreadById(id: string): DirectThread | undefined {
  return THREADS.find((t) => t.id === id);
}

export function getStudentThread(studentId: string): DirectThread | undefined {
  return THREADS.find((t) => t.kind === "student" && t.studentId === studentId);
}

export function getParentThread(studentId: string): DirectThread | undefined {
  return THREADS.find((t) => t.kind === "parent" && t.studentId === studentId);
}
