import { describe, expect, it } from "vitest";
import { actionFor, parseCard } from "./dashboard";

const card = (extra: Record<string, unknown> = {}) => parseCard({
  assignment_id: "55555555-5555-4555-8555-555555555555", class_id: "11111111-1111-4111-8111-111111111111", class_name: "Grade 8",
  title: "Rounding check", unit_code: "U1", unit_name: "Rounding", attempt_rule: "single", created_at: new Date("2026-11-18T09:00:00Z"),
  latest_session_id: null, latest_state: null, answered: 0, question_budget: null, attempts: 0, ...extra,
});
const sid = "77777777-7777-4777-8777-777777777777";

describe("assignment card actions", () => {
  it("starts a fresh assignment from the assignment link", () => {
    expect(actionFor(card())).toEqual({ kind: "start", label: "Start",
      href: "/student/diagnostic/U1?assignment=55555555-5555-4555-8555-555555555555" });
  });

  it("resumes the in-progress attempt itself, never a new one", () => {
    expect(actionFor(card({ latest_state: "in_progress", latest_session_id: sid, answered: 2, question_budget: 8, attempts: 1 })))
      .toEqual({ kind: "resume", label: "Resume",
        href: `/student/diagnostic/U1?session=${sid}&assignment=55555555-5555-4555-8555-555555555555` });
  });

  it("is done after one attempt at a single assignment, and offers another for repeat", () => {
    const submitted = { latest_state: "submitted", latest_session_id: sid, answered: 4, question_budget: 8, attempts: 1 };
    expect(actionFor(card(submitted))).toEqual({ kind: "done", label: "Done" });
    expect(actionFor(card({ ...submitted, attempt_rule: "repeat" }))).toMatchObject({ kind: "start", label: "Start again" });
  });
});

describe("card parser", () => {
  it("keeps only the allowed fields and rejects result states", () => {
    const parsed = parseCard({ ...card(), outcome: "diagnosed", posterior: [1], latest_state: null });
    expect(Object.keys(parsed).sort()).toEqual(["answered", "assignment_id", "attempt_rule", "attempts", "class_id", "class_name",
      "created_at", "latest_session_id", "latest_state", "question_budget", "title", "unit_code", "unit_name"]);
    expect(() => card({ latest_state: "diagnosed" })).toThrow();
  });
});
