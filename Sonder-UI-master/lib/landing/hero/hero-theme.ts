/**
 * Every tunable for the hero intro: the wordmark draw-on, the pin, and the
 * brain's scroll-driven entry.
 *
 * Colours are NOT here — the wordmark reuses the palette already defined in
 * src/vine.css and src/brain-viewer.css, restated in src/hero-stage.css.
 * Mirrors the convention of teal-theme.ts and vine-theme.ts: one flat file of
 * named constants, retuned in place.
 */

/* --------------------------------------------------------------- the pin */

/** Length of the pinned hero, in viewport heights of scroll. The whole intro —
 *  wordmark exit, brain entry, and the settling dwell — happens inside this.
 *  Below ~0.7 the entry feels rushed; above ~1.4 it feels like the page is stuck. */
export const HERO_PIN_VH = 1.0;

/** ScrollTrigger scrub for the hero timeline, in seconds of catch-up.
 *  Slightly tighter than the vine's 0.95 because the brain is a heavy object and
 *  too much lag reads as lag, not weight. */
export const HERO_SCRUB = 0.9;

/* ------------------------------------------------------- timeline staging */
/* All values are positions on a timeline whose total duration is exactly 1.0. */

/** The brain finishes arriving at this point. The remainder is dwell: the brain
 *  sits in its rest pose, auto-rotating, while the veil fades in. */
export const HERO_ENTRY_END = 0.72;

/** The wordmark has fully exited by this point — before the brain arrives, so the
 *  two never fight for the centre of the frame. */
export const HERO_WORDMARK_EXIT_END = 0.45;

/** How far the wordmark rises on its way out, as a percentage of its own height. */
export const HERO_WORDMARK_RISE_PCT = 60;

/** Final opacity of the charcoal veil at the end of the pin.
 *  Kept at 0 so the hero matches the page-wide Aether Flow backdrop. */
export const HERO_VEIL_OPACITY = 0;

/* --------------------------------------------------------- the entry pose */
/*
 * These describe the brain's pose at entry progress 0. At progress 1 every one of
 * them has been interpolated away and the pivot sits exactly at
 * ORGAN_HOME_ROTATION / origin / scale 1 — the canonical rest pose.
 */

/**
 * Pivot Y at progress 0 — fully below the camera frustum.
 *
 * Derived, not guessed. The camera is at z = 13.5 with a 34 degree vertical FOV,
 * so the frustum half-height at z = 0 is tan(17 deg) * 13.5 = 4.1274. FIT_SIZE
 * normalises the model's LONGEST axis (X) to 3.8, which puts its height at 3.4911
 * and its half-height at 1.7455. 4.1274 + 1.7455 = 5.873 exactly clears the bottom
 * edge; -6.6 adds ~12% margin so no rim glow peeks through on any aspect ratio.
 */
export const ENTRY_Y_START = -6.6;

/** Pivot Z at progress 0 — pushed back, so the brain also advances toward the
 *  camera as it rises. Subtle; it is what stops the motion reading as a flat
 *  vertical slide. */
export const ENTRY_Z_START = -2.2;

/** Pivot scale at progress 0. Combines with ENTRY_Z_START to sell the approach. */
export const ENTRY_SCALE_START = 0.82;

/** Extra X rotation at progress 0, in radians (~31 deg). The brain is tipped
 *  forward at the bottom of its travel and levels out as it arrives. */
export const ENTRY_TILT_X = 0.55;

/** Extra Y rotation at progress 0, in radians. Unwinds in lockstep with the
 *  rise so the rest pose and rest height land together. Negative = clockwise
 *  from above. */
export const ENTRY_SPIN_Y = -Math.PI * 1.15;

/** Extra Z roll at progress 0, in radians (~13 deg). A small amount of roll keeps
 *  the motion from looking mechanical. */
export const ENTRY_ROLL_Z = 0.22;

/** At or above this entry progress the brain is considered "arrived": the pivot is
 *  at its rest pose and camera auto-rotate is handed control. Must be < 1 so that
 *  floating-point scrub values still trip it. */
export const ENTRY_ARRIVED = 0.999;

/* ----------------------------------------------------- wordmark: geometry */
/* Authoring space for one glyph: x in [0, 64], y in [0, 92], baseline at y = 92. */

export const WM_GLYPH_W = 64;
export const WM_CAP_H = 92;

/** Total height of the wordmark band, including construction guides above and below. */
export const WM_BAND_H = 300;
/** Y offset at which the glyph row is placed inside the band. */
export const WM_GLYPH_TOP = 104;
/** Horizontal padding inside the viewBox, so wide strokes are not clipped. */
export const WM_PAD = 40;

/** Letter-spacing (gap between glyph boxes) in user units, per breakpoint.
 *  The reference's look depends on this being extreme — do not reduce LG below
 *  about 120 or the word stops reading as a technical drawing and starts reading
 *  as a logo. */
export const WM_TRACKING_SM = 54;
export const WM_TRACKING_MD = 96;
export const WM_TRACKING_LG = 170;
/** Viewport widths at which tracking steps up. */
export const WM_BREAK_SM = 640;
export const WM_BREAK_MD = 1024;

/** Construction rectangles: y position and height, above and below the glyph row. */
export const WM_GUIDE_TOP_Y = 20;
export const WM_GUIDE_TOP_H = 64;
export const WM_GUIDE_BOT_Y = 216;
export const WM_GUIDE_BOT_H = 64;
/** Which glyph indices get a construction rectangle above and below them.
 *  0-based into "SONDER". [2, 4] = N and E, matching the reference's placement
 *  over the middle of the word. */
export const WM_GUIDE_INDICES = [2, 4];

/** Y of the two full-width hairline rules (cap height and baseline). */
export const WM_RULE_CAP_Y = WM_GLYPH_TOP;
export const WM_RULE_BASE_Y = WM_GLYPH_TOP + WM_CAP_H;

/** Registration crosshair: centre Y, and arm half-length. */
export const WM_CROSS_Y = 8;
export const WM_CROSS_ARM = 7;

/* ---------------------------------------------------- wordmark: animation */

/** Seconds before the draw-on begins, so the page has settled first. */
export const WM_DELAY = 0.35;
/** Guides (crosshair, rules, rectangles) draw first and set the stage. */
export const WM_GUIDE_DUR = 0.7;
export const WM_GUIDE_STAGGER = 0.08;
/** Then the letters. */
export const WM_GLYPH_START = 0.22;
export const WM_GLYPH_DUR = 0.62;
/** Per-stroke stagger. This is what makes it read as a pen drawing one stroke at
 *  a time rather than six letters fading in. */
export const WM_GLYPH_STAGGER = 0.045;
