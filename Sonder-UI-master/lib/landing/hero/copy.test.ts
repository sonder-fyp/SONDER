import { describe, expect, it } from "vitest";
import {
  HERO_HEADLINE,
  HERO_HEADLINE_ACCENT,
  HERO_HEADLINE_LEAD,
  HERO_KICKER,
} from "./copy";

describe("hero statement copy", () => {
  it("is the two-line statement used on the landing hero", () => {
    expect(HERO_HEADLINE_LEAD).toBe("Beyond Right or Wrong:");
    expect(HERO_HEADLINE_ACCENT).toBe("We Decode Every Misconception");
    expect(HERO_HEADLINE).toBe(
      "Beyond Right or Wrong: We Decode Every Misconception",
    );
  });

  it("keeps the kicker as a label, not a second headline", () => {
    expect(HERO_KICKER).toBe(
      "Final-year project. Adaptive misconception diagnosis.",
    );
  });

  it("does not use em or en dashes", () => {
    const all = `${HERO_KICKER}${HERO_HEADLINE}`;
    expect(all).not.toMatch(/[\u2013\u2014]/);
  });

  it("stays two lines: four words, then four words", () => {
    expect(HERO_HEADLINE_LEAD.trim().split(/\s+/)).toHaveLength(4);
    expect(HERO_HEADLINE_ACCENT.trim().split(/\s+/)).toHaveLength(4);
  });

  it("fits a two-line poster without the old 15ch word-stack", () => {
    // 15ch at display size wraps almost every word. Both lines must be long
    // enough to read as a phrase, and short enough for a laptop hero band.
    expect(HERO_HEADLINE_LEAD.length).toBeGreaterThan(12);
    expect(HERO_HEADLINE_LEAD.length).toBeLessThan(28);
    expect(HERO_HEADLINE_ACCENT.length).toBeGreaterThan(16);
    expect(HERO_HEADLINE_ACCENT.length).toBeLessThan(40);
    expect(HERO_HEADLINE.length).toBeLessThan(64);
  });

  it("does not ship the previous overflowing headline", () => {
    expect(HERO_HEADLINE.toLowerCase()).not.toContain("does not mark");
    expect(HERO_HEADLINE.toLowerCase()).not.toContain("underneath");
  });
});
