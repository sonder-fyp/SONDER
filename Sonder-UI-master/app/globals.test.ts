import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const css = readFileSync(
  path.join(process.cwd(), "app/globals.css"),
  "utf8",
);

/** Tokens that are structural, not palette, and correctly live only on :root. */
const DARK_ONLY = new Set([
  "--stack-sans",
  "--stack-mono",
  "--stack-quote",
  "--ease",
  "--topbar-h",
  "--nav-w",
  "--nav-w-collapsed",
  "--theme-wipe-ms",
]);

function slice(marker: string): string {
  const open = `/* == TOKENS:${marker} == */`;
  const close = `/* == /TOKENS:${marker} == */`;
  const start = css.indexOf(open);
  const end = css.indexOf(close);
  expect(start, `missing ${open} in app/globals.css`).toBeGreaterThan(-1);
  expect(end, `missing ${close} in app/globals.css`).toBeGreaterThan(start);
  return css.slice(start + open.length, end);
}

function tokens(block: string): Set<string> {
  return new Set(
    [...block.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]),
  );
}

describe("globals.css palettes", () => {
  const dark = tokens(slice("DARK"));
  const light = tokens(slice("LIGHT"));

  it("gives every dark palette token a light counterpart", () => {
    const missing = [...dark].filter(
      (t) => !DARK_ONLY.has(t) && !light.has(t),
    );
    expect(missing, `light palette is missing: ${missing.join(", ")}`).toEqual([]);
  });

  it("does not invent tokens that exist only in light", () => {
    const extra = [...light].filter((t) => !dark.has(t));
    expect(extra, `light palette has orphans: ${extra.join(", ")}`).toEqual([]);
  });

  it("declares color-scheme in both", () => {
    expect(slice("DARK")).toContain("color-scheme: dark");
    expect(slice("LIGHT")).toContain("color-scheme: light");
  });

  it("never puts the neon accent on the paper ground", () => {
    const lightBlock = slice("LIGHT").toLowerCase();
    // #39ff14 is legal in the light block ONLY as --paper-accent, because that
    // band is charcoal in light mode.
    const neonLines = lightBlock
      .split("\n")
      .filter((l) => l.includes("#39ff14"));
    expect(neonLines.every((l) => l.includes("--paper-accent"))).toBe(true);
  });

  it("keeps .paper-band free of literal colour so it can invert", () => {
    const start = css.indexOf(".paper-band {");
    const band = css.slice(start, css.indexOf("}", start));
    expect(band).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(band).not.toMatch(/rgba?\(/i);
  });
});
