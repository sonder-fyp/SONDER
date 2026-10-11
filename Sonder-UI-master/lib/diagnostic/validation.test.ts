import { describe, expect, it } from "vitest";
import { parseAnswer, parseBegin, parseCatalogue, parseError, parseSnapshot } from "./validation";

import { sid, catalogue, snapshot } from "./testFixtures";
describe("diagnostic contract", () => {
  it("projects success JSON at every nesting level", () => {
    const v = snapshot();
    const contaminated = { ...v, trace: { posterior: [1] }, outcome: "diagnosed",
      unit: { ...v.unit, misconception: "MATH-secret" }, question: { ...v.question, correct_index: 2,
        options: v.question!.options.map(o => ({ ...o, is_correct: true, links: ["MATH-secret"] })) } };
    expect(parseSnapshot(contaminated)).toEqual(v);
    expect(parseCatalogue({ ...catalogue, trace: {}, units: catalogue.units.map(u => ({ ...u, hypotheses: [] })) })).toEqual(catalogue);
  });
  it("enforces status, question, counts and options", () => {
    for (const v of [{ ...snapshot(), status: "diagnosed" }, { ...snapshot(), question: null },
      { ...snapshot(2, true), question: snapshot().question }, { ...snapshot(), answered_count: true },
      { ...snapshot(), answered_count: 9 }, { ...snapshot(), contract_version: 2 },
      { ...snapshot(), question: { ...snapshot().question, step_index: 3 } },
      { ...snapshot(), question: { ...snapshot().question, options: [] } },
      { ...snapshot(), session_id: "../trace" }]) expect(() => parseSnapshot(v)).toThrow();
    expect(parseSnapshot(snapshot(4, true)).status).toBe("complete");
  });
  it("rejects coerced and extra request fields", () => {
    const answer = { step_index: 0, item_id: "T1-005", option_id: "D" };
    expect(parseAnswer(answer)).toEqual(answer);
    for (const body of [{ ...answer, step_index: "0" }, { ...answer, step_index: true },
      { ...answer, option_id: "Answer D" }, { ...answer, posterior: [] }]) expect(() => parseAnswer(body)).toThrow();
    expect(parseBegin({ unit_id: "U1", create_request_id: sid })).toEqual({ unit_id: "U1", create_request_id: sid });
    expect(() => parseBegin({ unit_id: "U1", create_request_id: "predictable" })).toThrow();
  });
  it("accepts only known error/status pairs", () => {
    expect(parseError({ error: { code: "answer_conflict", detail: "secret" } }, 409)).toBe("answer_conflict");
    expect(() => parseError({ error: { code: "MATH-secret" } }, 409)).toThrow();
    expect(() => parseError({ error: { code: "answer_conflict" } }, 500)).toThrow();
  });
});
