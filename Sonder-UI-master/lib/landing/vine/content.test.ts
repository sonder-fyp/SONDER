import { describe, expect, it } from "vitest";
import { VINE_NODES } from "./content";

describe("VINE_NODES", () => {
  it("has six nodes with unique ids", () => {
    expect(VINE_NODES).toHaveLength(6);
    expect(new Set(VINE_NODES.map((n) => n.id)).size).toBe(6);
  });

  it("ships no placeholder copy", () => {
    for (const n of VINE_NODES) {
      const all = `${n.eyebrow} ${n.title} ${n.body} ${n.meta ?? ""}`.toLowerCase();
      expect(all).not.toContain("placeholder");
      expect(all).not.toContain("lorem");
    }
  });

  it("contains no em-dash or en-dash in any visible string", () => {
    for (const n of VINE_NODES) {
      const all = `${n.eyebrow}${n.title}${n.body}${n.meta ?? ""}`;
      expect(all).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("keeps bodies inside the length the layout was tuned for", () => {
    for (const n of VINE_NODES) {
      expect(n.body.length).toBeGreaterThanOrEqual(120);
      expect(n.body.length).toBeLessThanOrEqual(360);
    }
  });
});
