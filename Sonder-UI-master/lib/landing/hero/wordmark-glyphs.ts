/**
 * SONDER as hand-authored technical-pen strokes.
 *
 * Authoring space per glyph: x in [0, 64], y in [0, 92], baseline at y = 92.
 * Each glyph is an ORDERED array of independent pen strokes, drawn in array order.
 * Splitting a letter into its real strokes is what produces the reference image's
 * look, where a glyph is caught mid-construction with some strokes drawn and
 * others not yet started (an "A" with no crossbar, an "N" missing its diagonal).
 *
 * These `d` strings are CONSTANT. Glyphs are positioned with a <g transform>, never
 * by baking an x offset into the path data — see plan section 2.5 for why that
 * matters when tracking changes on resize.
 */

export type Glyph = {
  /** The character, for the accessible label and for debugging. */
  char: string;
  /** Pen strokes, in drawing order. */
  strokes: string[];
};

/** Round forms (S, O) overshoot the cap line slightly, as real typefaces do. */
export const SONDER_GLYPHS: Glyph[] = [
  {
    char: "S",
    // One continuous pen stroke: upper terminal, over the top, through the waist,
    // around the bowl, out to the lower terminal.
    strokes: [
      "M 58 20 C 58 9 47 2 32 2 C 17 2 6 9 6 21 C 6 33 16 39 32 44 C 48 49 58 56 58 68 C 58 81 47 90 32 90 C 17 90 6 82 6 71",
    ],
  },
  {
    char: "O",
    // One closed stroke. Ellipse centred (32, 46), rx 28, ry 44.
    // Control offsets: 28 * 0.5523 = 15.5 horizontally, 44 * 0.5523 = 24.3 vertically.
    strokes: [
      "M 32 2 C 47.5 2 60 21.7 60 46 C 60 70.3 47.5 90 32 90 C 16.5 90 4 70.3 4 46 C 4 21.7 16.5 2 32 2 Z",
    ],
  },
  {
    char: "N",
    strokes: [
      "M 4 90 L 4 2", // left stem, drawn upward
      "M 4 2 L 60 90", // diagonal
      "M 60 90 L 60 2", // right stem, drawn upward
    ],
  },
  {
    char: "D",
    strokes: [
      "M 6 2 L 6 90", // stem
      "M 6 2 L 30 2 C 47 2 58 21 58 46 C 58 71 47 90 30 90 L 6 90", // bowl
    ],
  },
  {
    char: "E",
    strokes: [
      "M 6 2 L 6 90", // stem
      "M 6 2 L 54 2", // top arm
      "M 6 46 L 46 46", // middle arm (shorter, as in a geometric sans)
      "M 6 90 L 54 90", // bottom arm
    ],
  },
  {
    char: "R",
    strokes: [
      "M 6 2 L 6 90", // stem
      "M 6 2 L 34 2 C 46 2 54 11 54 24 C 54 37 46 46 34 46 L 6 46", // bowl
      "M 31 46 L 57 90", // leg
    ],
  },
];

/** Total pen strokes across the word — 14. Used only by the verification checklist. */
export const SONDER_STROKE_COUNT = SONDER_GLYPHS.reduce(
  (n, g) => n + g.strokes.length,
  0,
);

/* ------------------------------------------------------- guide geometry */
/*
 * All guide paths are authored in LOCAL space starting at (0, 0) and placed with a
 * <g transform>, for the same path-identity reason as the glyphs.
 */

/** Construction rectangle above a glyph: open at the bottom, as in the reference. */
export function guideRectTop(w: number, h: number): string {
  return `M 0 ${h} L 0 0 L ${w} 0 L ${w} ${h}`;
}

/** Construction rectangle below a glyph: open at the top. */
export function guideRectBottom(w: number, h: number): string {
  return `M 0 0 L 0 ${h} L ${w} ${h} L ${w} 0`;
}

/** Registration crosshair, centred on (0, 0). */
export function crosshair(arm: number): string {
  return `M ${-arm} 0 L ${arm} 0 M 0 ${-arm} L 0 ${arm}`;
}
