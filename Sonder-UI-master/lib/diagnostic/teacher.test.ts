// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/access", () => ({
  AccessError: class AccessError extends Error {
    constructor(public status: 401 | 403, message: string) { super(message); }
  },
  requireApiRole: vi.fn(async () => ({
    user: { id: "00000000-0000-4000-8000-000000000001" },
    account: { id: "00000000-0000-4000-8000-000000000002", role: "teacher" },
  })),
}));
import { latestTeacherRoute } from "./routes";
import { parseLatest } from "./teacher";
import { sid } from "./testFixtures";

const hyps = [
  { slot: 0, hypothesis_id: "MATH-1379", kind: "misconception", prior: 0.175 },
  { slot: 1, hypothesis_id: "MATH-1988", kind: "misconception", prior: 0.175 },
  { slot: 2, hypothesis_id: "NONE", kind: "none", prior: 0.25 },
  { slot: 3, hypothesis_id: "UNMODELLED", kind: "unmodelled", prior: 0.05 },
];
function step(index: number, posterior: number[], decision: Record<string, unknown>) {
  return {
    step_index: index,
    question: { step_index: index, item_id: `T1-00${index + 5}`, selection_reason: "Chosen to separate NONE from MATH-1379.",
      entropy_before: 2.4, expected_ig: 0.7887, candidates: [{ rank: 1, item_id: `T1-00${index + 5}`, eig: 0.7887 }] },
    option_id: "B", option_index: 1, answer_note: "Chose B (23,000), linked to MATH-1379.",
    posterior, support: [2, 0, 1, 0], decision,
  };
}
function upstream(overrides: Record<string, unknown> = {}) {
  const decision = { outcome: "diagnosed", rule: "R1", leader: "MATH-1379", tied: [], leader_share: null, reachable_share: null, support: 2,
    exhausted_by: null, detail: "R1: MATH-1379 at p = 0.942 with 2 supporting answers (theta = 0.80, min_support = 2)." };
  return {
    session_id: sid, finished_seq: 3, unit: { unit_id: "U1", name: "Rounding" },
    trace: {
      content_version: "Maths_v2", unit_id: "U1", question_budget: 8, hypotheses: hyps, pending: null,
      steps: [step(0, [0.3, 0.05, 0.6, 0.05], { ...decision, outcome: "in_progress", rule: null, leader: "NONE", detail: "" }),
        step(1, [0.9423, 0.01, 0.03, 0.0177], decision)],
      outcome: { outcome: "diagnosed", rule: "R1", diagnosis_candidates: [[1, 0], [2, 2]], escalation_reason: null,
        escalation_leader_slot: null, escalation_candidates: [], leader_share: null, reachable_share: null },
    },
    hypothesis_names: { "MATH-1379": "Rounds down instead of up", "MATH-1988": "Rounds up instead of down" },
    ...overrides,
  };
}

describe("teacher demo view", () => {
  it("reduces the service trace to the teacher result", () => {
    const result = parseLatest(upstream());
    expect(result).toMatchObject({ session_id: sid, finished_seq: 3, outcome: "diagnosed", rule: "R1",
      leader: "MATH-1379", leader_name: "Rounds down instead of up", answered_count: 2, tied: [] });
    expect(result.hypotheses.map(h => [h.id, h.name, h.final, h.support])).toEqual([
      ["MATH-1379", "Rounds down instead of up", 0.9423, 2],
      ["MATH-1988", "Rounds up instead of down", 0.01, 0],
      ["NONE", "No misconception", 0.03, 1],
      ["UNMODELLED", "Outside the catalogue", 0.0177, 0]]);
    expect(result.steps.map(s => [s.item_id, s.leader, s.leader_probability])).toEqual([
      ["T1-005", "NONE", 0.6], ["T1-006", "MATH-1379", 0.9423]]);
    expect(result.detail).toContain("R1");
  });

  it("keeps the tied set of a refusal", () => {
    const decision = { outcome: "escalated_no_separator", rule: "R4", leader: "MATH-1379", tied: ["MATH-1379", "MATH-1988"],
      leader_share: 0.5, reachable_share: 0.5, support: 2, exhausted_by: null, detail: "R4: no remaining item separates MATH-1379 and MATH-1988." };
    const base = upstream();
    const value = upstream({ trace: { ...base.trace, steps: [step(0, [0.48, 0.48, 0.02, 0.02], decision)],
      outcome: { ...base.trace.outcome, outcome: "escalated_no_separator", rule: "R4" } } });
    const result = parseLatest(value);
    expect(result.outcome).toBe("escalated_no_separator");
    expect(result.tied).toEqual(["MATH-1379", "MATH-1988"]);
  });

  it("refuses unfinished, malformed or inconsistent traces", () => {
    const base = upstream();
    expect(() => parseLatest(upstream({ trace: { ...base.trace, pending: { item_id: "T1-007" } } }))).toThrow();
    expect(() => parseLatest(upstream({ session_id: "not-an-id" }))).toThrow();
    expect(() => parseLatest(upstream({ trace: { ...base.trace, outcome: { ...base.trace.outcome, outcome: "in_progress" } } }))).toThrow();
    expect(() => parseLatest(upstream({ trace: { ...base.trace, steps: [] } }))).toThrow();
    const short = step(1, [0.5, 0.5], base.trace.steps[1].decision as Record<string, unknown>);
    expect(() => parseLatest(upstream({ trace: { ...base.trace, steps: [base.trace.steps[0], short] } }))).toThrow();
    expect(() => parseLatest("nope")).toThrow();
  });
});

describe("latestTeacherRoute", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("SONDER_ENGINE_TOKEN", "t".repeat(32));
    vi.stubEnv("SONDER_COOKIE_KEY", "k".repeat(32));
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("asks the service with the token only and returns the reduced result", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(upstream()));
    const response = await latestTeacherRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/engine/latest");
    expect(options.headers["X-Sonder-Token"]).toBe("t".repeat(32));
    expect(options.headers["X-Sonder-Owner"]).toBeUndefined();
    const body = await response.json();
    expect(body.outcome).toBe("diagnosed");
    expect(body).not.toHaveProperty("trace");
    expect(body).not.toHaveProperty("hypothesis_names");
  });

  it("passes through 'nothing finished yet' and hides a bad upstream reply", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "session_unavailable" } }, { status: 404 }));
    expect((await latestTeacherRoute()).status).toBe(404);
    fetchMock.mockResolvedValueOnce(Response.json({ trace: "garbage" }));
    const bad = await latestTeacherRoute();
    expect(bad.status).toBe(503);
    expect(JSON.stringify(await bad.json())).not.toContain("garbage");
  });
});
