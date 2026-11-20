import { describe, expect, it } from "vitest";
import { pixelRatioForBudget } from "./render-budget";

describe("rendering pixel budget", () => {
  it("limits physical pixels for a large high-density viewport", () => {
    const ratio = pixelRatioForBudget(1920, 895, 2, 1_500_000, 1.25);
    expect(1920 * 895 * ratio * ratio).toBeLessThanOrEqual(1_500_000.01);
    expect(ratio).toBeLessThan(1);
  });
  it("keeps device resolution for a small viewport within budget", () => {
    expect(pixelRatioForBudget(320, 240, 1, 1_500_000, 1.25)).toBe(1);
  });
  it("honours the ratio cap and handles invalid device ratios", () => {
    expect(pixelRatioForBudget(320, 240, 3, 1_500_000, 1.25)).toBe(1.25);
    expect(pixelRatioForBudget(320, 240, 0, 1_500_000, 1.25)).toBe(1);
  });
});
