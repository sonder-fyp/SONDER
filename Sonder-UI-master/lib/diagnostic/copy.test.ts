import { describe, expect, it } from "vitest";
import { answersSaved } from "./copy";

describe("answersSaved", () => {
  it.each([
    [0, "0 answers saved"],
    [1, "1 answer saved"],
    [2, "2 answers saved"],
  ])("%i -> %s", (count, text) => {
    expect(answersSaved(count)).toBe(text);
  });
});
