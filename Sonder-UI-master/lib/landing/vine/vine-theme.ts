/**
 * Every geometry / behaviour tunable for the scroll-grown vine.
 *
 * COLOURS AND STROKE WIDTHS ARE NOT HERE — they live in `src/vine.css`.
 * The SVG viewBox is 1:1 with CSS pixels, so CSS owns everything visual and this
 * file owns everything the layout maths needs. Do not duplicate values across
 * the two.
 *
 * Mirrors the convention of `src/lib/three/teal-theme.ts`: one flat file of
 * named constants, retuned in place, imported everywhere else.
 */

/* ------------------------------------------------------------------ layout */

/** Below this viewport width the vine switches from a centred serpentine to a
 *  left-hand rail with all cards stacked to its right. */
export const VINE_RAIL_BREAKPOINT = 860;

/**
 * Centred layout: horizontal swing of the spine either side of centre, as a
 * fraction of section width, then clamped.
 *
 * THIS VALUE IS CONSTRAINED, not free. The waypoint jitter can push the spine out
 * to `amp * 1.15`, and it must still clear the inner edge of a card by a usable
 * margin or the branch degenerates into a stub. With `--v-card-w: min(400px, 34%)`
 * and the row padding in vine.css, the worst case is the narrowest centred layout
 * (~860px wide):
 *
 *   amp = 860 * 0.06 = 51.6  ->  spine reaches 489px, card inner edge is 509px
 *   -> a 19px branch. Workable.
 *
 * At 0.075 the same width yields a **4px** branch. Do not raise this above ~0.065
 * without also narrowing `--v-card-w`.
 */
export const VINE_AMP_FRAC = 0.06;
export const VINE_AMP_MIN = 40;
export const VINE_AMP_MAX = 130;

/** Rail layout: x of the rail, as a fraction of width, then clamped.
 *  The max is bounded by the 92px left padding the rail rows reserve: the spine
 *  can reach RAIL_X_MAX + RAIL_AMP = 56px, leaving a 20px branch to the card. */
export const VINE_RAIL_X_FRAC = 0.085;
export const VINE_RAIL_X_MIN = 24;
export const VINE_RAIL_X_MAX = 44;
/** Rail layout swing. Small — the rail should read as almost straight. */
export const VINE_RAIL_AMP = 12;

/** How far above the vine section's top edge the vine starts, in px. This is the
 *  overlap into the hero that makes the vine read as sprouting from the brain. */
export const VINE_OVERHANG = 150;

/** Distance from the section's bottom edge at which the vine terminates, in px. */
export const VINE_TAIL_INSET = 90;

/** Vertical offset from a card's top edge to the point the branch attaches to.
 *  Tuned to land on the eyebrow line of the card. */
export const VINE_ANCHOR_INSET = 30;

/** Horizontal gap between a card's inner edge and the branch tip, in px. */
export const VINE_BRANCH_GAP = 16;

/* ------------------------------------------------------------------- curve */

/** Catmull-Rom tension. 0.5 = the classic uniform spline. Lower = tighter,
 *  higher = loopier. Above ~0.8 the curve starts to self-intersect. */
export const VINE_TENSION = 0.5;

/** Seeds the PRNG that jitters the waypoints, leaf sizes and angles. Change it
 *  to reshuffle the vine's organic variation; keep it fixed so the vine looks
 *  identical across reloads and resizes. */
export const VINE_SEED = 20260904;

/** Samples per spine segment for the y -> arc-length lookup table. 64 is ample:
 *  a 900px segment resolves to ~14px per sample, and we interpolate between. */
export const VINE_SAMPLES_PER_SEGMENT = 64;

/* ---------------------------------------------------------- leaves/tendrils */

/** One leaf per this many px of spine arc length. */
export const VINE_LEAF_SPACING = 165;
/** Base leaf length in px, jittered ±25%. */
export const VINE_LEAF_LEN = 30;
/** Base leaf half-width in px. */
export const VINE_LEAF_WIDTH = 11;
/** Angle between the spine tangent and the leaf axis, in degrees. */
export const VINE_LEAF_ANGLE_DEG = 62;
/** Random jitter added to that angle, in degrees. */
export const VINE_LEAF_ANGLE_JITTER_DEG = 16;

/** One tendril per this many px of spine arc length. Sparser than leaves. */
export const VINE_TENDRIL_SPACING = 430;
/** Length of a tendril's first curl segment, in px. */
export const VINE_TENDRIL_LEN = 34;
/** Angle off the spine tangent, in degrees. */
export const VINE_TENDRIL_ANGLE_DEG = 96;
/** Degrees of rotation added per curl step — this is what makes the fiddlehead. */
export const VINE_TENDRIL_CURL_DEG = 46;
/** Number of curl segments. 4 gives roughly three-quarters of a turn. */
export const VINE_TENDRIL_STEPS = 4;

/* ---------------------------------------------------------------- behaviour */

/** Fraction of the viewport height at which the growing tip is pinned.
 *  0.52 = near centre, which reads as "the vine is leading you down". */
export const VINE_FRONT_VH = 0.52;

/** ScrollTrigger scrub, in seconds of catch-up. 0 = locked to scroll (stiff);
 *  ~0.95 pairs with Lenis inertia for organic lag. Above ~1.2 it feels detached. */
export const VINE_SCRUB = 0.95;

/** Reveal thresholds are compared against `frontY` in px.
 *  An element opens when frontY >= atY, and only closes again once frontY has
 *  gone back above atY - HYSTERESIS. Without this an element parked exactly on
 *  the threshold flickers on every sub-pixel scroll tick. */
export const VINE_HYSTERESIS = 32;

/** Text cards open this many px BEFORE the tip reaches their anchor, so the copy
 *  is already legible by the time the vine arrives. */
export const VINE_NODE_LEAD = 120;

/** Skip a strokeDashoffset write when the change is smaller than this many px. */
export const VINE_WRITE_EPSILON = 0.25;

/* ------------------------------------------------------------------ pulses */

/** Travelling charge dots, mirroring NeuronActivity's pulses inside the brain.
 *  Set to 0 to disable them entirely. */
export const VINE_PULSE_COUNT: number = 5;
/** Pulse travel speed along the spine, px per second. */
export const VINE_PULSE_SPEED = 190;
/** Random extra speed, px per second. */
export const VINE_PULSE_SPEED_JITTER = 90;
/** Seconds a finished pulse waits before respawning. */
export const VINE_PULSE_RESPAWN = [0.4, 1.9] as const;
