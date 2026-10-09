/**
 * Geometry engine for the scroll-grown vine.
 *
 * Everything here works in SECTION PIXEL SPACE: the origin is the top-left of the
 * vine <section>, +y is downwards, and one unit is one CSS pixel. The SVG viewBox
 * is set to match, so no scaling ever happens.
 *
 * The only impure part is `withMeasuredPaths`, which briefly appends a hidden
 * <svg> to document.body because getTotalLength/getPointAtLength require an
 * in-document SVGPathElement (detached elements are unreliable in Safari).
 */

import {
  VINE_AMP_FRAC,
  VINE_AMP_MAX,
  VINE_AMP_MIN,
  VINE_ANCHOR_INSET,
  VINE_LEAF_ANGLE_DEG,
  VINE_LEAF_ANGLE_JITTER_DEG,
  VINE_LEAF_LEN,
  VINE_LEAF_SPACING,
  VINE_LEAF_WIDTH,
  VINE_OVERHANG,
  VINE_RAIL_AMP,
  VINE_RAIL_BREAKPOINT,
  VINE_RAIL_X_FRAC,
  VINE_RAIL_X_MAX,
  VINE_RAIL_X_MIN,
  VINE_SAMPLES_PER_SEGMENT,
  VINE_SEED,
  VINE_TAIL_INSET,
  VINE_TENDRIL_ANGLE_DEG,
  VINE_TENDRIL_CURL_DEG,
  VINE_TENDRIL_LEN,
  VINE_TENDRIL_SPACING,
  VINE_TENDRIL_STEPS,
  VINE_TENSION,
} from "./vine-theme";

const SVG_NS = "http://www.w3.org/2000/svg";

/* --------------------------------------------------------------------- types */

export type Pt = { x: number; y: number };
export type VineLayout = "center" | "rail";
export type Side = 1 | -1;

/** One sample of the y -> arc-length table. `y` is monotonically non-decreasing. */
export type YSample = { y: number; l: number };

export type VineSegment = {
  d: string;
  length: number;
  /** y of the segment's first point. */
  y0: number;
  /** y of the segment's last point. */
  y1: number;
  samples: YSample[];
};

export type VineLeaf = {
  /** Body outline, drawn in local space from (0,0) toward +x. */
  d: string;
  /** Midrib, same local space. */
  rib: string;
  /** Length of `d`, for the draw-on dash. */
  length: number;
  /** SVG transform attribute placing the leaf on the spine. */
  transform: string;
  /** Section-space y at which this leaf opens. */
  atY: number;
};

export type VineTendril = {
  d: string;
  length: number;
  atY: number;
};

export type VineNodeAnchor = {
  /** Where the branch leaves the spine, section space. */
  point: Pt;
  /** Where the branch meets the card, section space. */
  anchor: Pt;
  branchD: string;
  branchLength: number;
  atY: number;
  side: Side;
};

export type VineGeometry = {
  layout: VineLayout;
  width: number;
  height: number;
  /** viewBox string, already including the overhang above y = 0. */
  viewBox: string;
  /** CSS height the <svg> element must be given, in px. */
  svgHeight: number;
  /** CSS top offset the <svg> element must be given, in px (negative). */
  svgTop: number;
  /** Where the vine emerges — the top of the spine, section space. */
  origin: Pt;
  /** y of the tip at progress 0 (negative — inside the hero). */
  vineTopY: number;
  /** y of the tip at progress 1. */
  vineBottomY: number;
  segments: VineSegment[];
  leaves: VineLeaf[];
  tendrils: VineTendril[];
  nodes: VineNodeAnchor[];
};

/** What the component measures out of the DOM and hands to the builder. */
export type NodeMeasurement = {
  /** Section-space y of the branch attachment point on the card. */
  y: number;
  /** Section-space x of the card edge facing the spine. */
  innerX: number;
  /** -1 = card sits left of centre, +1 = right. Always +1 in rail layout. */
  side: Side;
};

/* ----------------------------------------------------------------- utilities */

export function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

export function clamp01(v: number) {
  return clamp(v, 0, 1);
}

/** Round to 2dp — keeps the emitted path strings (and therefore the DOM) small. */
function r2(v: number) {
  return Math.round(v * 100) / 100;
}

/**
 * mulberry32 — a tiny deterministic PRNG. Seeded once per build so the vine's
 * organic jitter is identical on every reload and every resize. Do NOT replace
 * this with Math.random(): the vine would reshuffle whenever the window resized.
 */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;

/* ------------------------------------------------------------ path builders */

/**
 * Emits the cubic-Bezier equivalent of the Catmull-Rom spline through
 * `pts[from..to]`, while still reading `pts[from-1]` and `pts[to+1]` as the
 * neighbouring control points. That is what makes consecutive sub-paths join
 * with C1 continuity — the joint is invisible even though it is two <path>s.
 *
 * With tension 0.5 this reduces to the classic uniform Catmull-Rom:
 *   c1 = p1 + (p2 - p0) / 6
 *   c2 = p2 - (p3 - p1) / 6
 */
export function catmullRomSubPath(
  pts: Pt[],
  from: number,
  to: number,
  tension = VINE_TENSION,
): string {
  if (to <= from) return "";
  const k = tension / 3; // tension 0.5 -> 1/6
  let d = `M ${r2(pts[from].x)} ${r2(pts[from].y)}`;
  for (let i = from; i < to; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(p2.x)} ${r2(p2.y)}`;
  }
  return d;
}

/**
 * An asymmetric teardrop leaf in LOCAL space: it starts at (0,0) — the point on
 * the spine — and extends toward +x. The caller rotates and translates it with a
 * transform attribute, which preserves arc length, so the measured length of this
 * local path is also the length of the placed one.
 */
export function leafPath(len: number, wid: number): string {
  return (
    `M 0 0` +
    ` C ${r2(len * 0.22)} ${r2(-wid)}, ${r2(len * 0.72)} ${r2(-wid * 0.9)}, ${r2(len)} 0` +
    ` C ${r2(len * 0.72)} ${r2(wid * 0.55)}, ${r2(len * 0.22)} ${r2(wid * 0.45)}, 0 0` +
    ` Z`
  );
}

/** The leaf's midrib, same local space. */
export function leafRibPath(len: number, wid: number): string {
  return `M 0 0 Q ${r2(len * 0.5)} ${r2(-wid * 0.18)}, ${r2(len * 0.92)} 0`;
}

/**
 * A fiddlehead curl: successive cubic segments, each shorter than the last and
 * each rotated a little further, which is what produces the spiral. Emitted in
 * SECTION space (unlike leaves) because it needs no separate transform.
 */
export function curlPath(
  x: number,
  y: number,
  angleRad: number,
  len: number,
  curlRad: number,
  steps: number,
): string {
  let d = `M ${r2(x)} ${r2(y)}`;
  let a = angleRad;
  let l = len;
  let px = x;
  let py = y;
  for (let i = 0; i < steps; i += 1) {
    const c1x = px + Math.cos(a) * l * 0.4;
    const c1y = py + Math.sin(a) * l * 0.4;
    a += curlRad;
    const c2x = px + Math.cos(a) * l * 0.75;
    const c2y = py + Math.sin(a) * l * 0.75;
    const nx = px + Math.cos(a) * l;
    const ny = py + Math.sin(a) * l;
    d += ` C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(nx)} ${r2(ny)}`;
    px = nx;
    py = ny;
    l *= 0.62;
  }
  return d;
}

/** The arc from the spine out to a text card. */
export function branchPath(s: Pt, a: Pt): string {
  const dx = a.x - s.x;
  const dy = a.y - s.y;
  const c1x = s.x + dx * 0.45;
  const c1y = s.y + dy * 0.15 - 26;
  const c2x = a.x - dx * 0.35;
  const c2y = a.y - dy * 0.05 - 6;
  return `M ${r2(s.x)} ${r2(s.y)} C ${r2(c1x)} ${r2(c1y)}, ${r2(c2x)} ${r2(c2y)}, ${r2(a.x)} ${r2(a.y)}`;
}

/* --------------------------------------------------------------- measurement */

/**
 * Runs `fn` with real, measurable SVGPathElements for each `d`, then tears them
 * down. The host <svg> must be IN the document — detached geometry measurement is
 * unreliable in Safari. It is 0x0 and visually hidden, so it cannot affect layout.
 */
export function withMeasuredPaths<T>(ds: string[], fn: (paths: SVGPathElement[]) => T): T {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText =
    "position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;";
  const paths = ds.map((d) => {
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return p;
  });
  document.body.appendChild(svg);
  try {
    return fn(paths);
  } finally {
    svg.remove();
  }
}

/**
 * Builds the y -> arc-length table for one segment. `y` is forced monotonically
 * non-decreasing: a Catmull-Rom curve can overshoot backwards by a pixel or two
 * at a tight turn, and a non-monotonic table would break the binary search.
 */
function sampleSegment(path: SVGPathElement, length: number): YSample[] {
  const out: YSample[] = [];
  let prevY = -Infinity;
  for (let i = 0; i <= VINE_SAMPLES_PER_SEGMENT; i += 1) {
    const l = (i / VINE_SAMPLES_PER_SEGMENT) * length;
    const pt = path.getPointAtLength(l);
    const y = pt.y > prevY ? pt.y : prevY;
    prevY = y;
    out.push({ y, l });
  }
  return out;
}

/**
 * How much of `seg` lies above `y`, in arc length. This is the function that
 * converts the pinned growth front into a stroke-dashoffset.
 */
export function lengthAtY(seg: VineSegment, y: number): number {
  const s = seg.samples;
  if (s.length === 0) return 0;
  if (y <= s[0].y) return 0;
  if (y >= s[s.length - 1].y) return seg.length;
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].y <= y) lo = mid;
    else hi = mid;
  }
  const span = s[hi].y - s[lo].y;
  const t = span > 1e-6 ? (y - s[lo].y) / span : 0;
  return s[lo].l + (s[hi].l - s[lo].l) * t;
}

/* ------------------------------------------------------------------- builder */

/**
 * Builds the complete vine from the section's pixel size and the measured card
 * anchors. Deterministic: same inputs always give the same vine.
 */
export function buildVineGeometry(
  width: number,
  height: number,
  nodes: NodeMeasurement[],
): VineGeometry {
  const layout: VineLayout = width < VINE_RAIL_BREAKPOINT ? "rail" : "center";
  const cx =
    layout === "center"
      ? width / 2
      : clamp(width * VINE_RAIL_X_FRAC, VINE_RAIL_X_MIN, VINE_RAIL_X_MAX);
  const amp =
    layout === "center"
      ? clamp(width * VINE_AMP_FRAC, VINE_AMP_MIN, VINE_AMP_MAX)
      : VINE_RAIL_AMP;

  const vineTopY = -VINE_OVERHANG;
  const vineBottomY = Math.max(height - VINE_TAIL_INSET, vineTopY + 1);

  const empty: VineGeometry = {
    layout,
    width,
    height,
    viewBox: `0 ${vineTopY} ${width} ${height - vineTopY}`,
    svgHeight: height + VINE_OVERHANG,
    svgTop: -VINE_OVERHANG,
    origin: { x: cx, y: vineTopY },
    vineTopY,
    vineBottomY,
    segments: [],
    leaves: [],
    tendrils: [],
    nodes: [],
  };
  if (!nodes.length || width <= 0 || height <= 0) return empty;

  const rand = mulberry32(VINE_SEED);

  /* ---- 1. waypoints. The spine passes exactly through every one of these ---- */

  const pts: Pt[] = [];
  const nodeIdx: number[] = [];

  pts.push({ x: cx, y: vineTopY });
  pts.push({ x: cx + (rand() - 0.5) * amp * 0.3, y: vineTopY * 0.3 });

  // A pre-swing away from the first card's side, so the vine visibly leans into
  // the first node instead of arriving at it head-on. Skipped when there is not
  // enough room above the first card.
  if (nodes[0].y > 180) {
    pts.push({
      x: cx - nodes[0].side * amp * (0.35 + rand() * 0.2),
      y: nodes[0].y * 0.55,
    });
  }

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    pts.push({ x: cx + n.side * amp * (0.85 + rand() * 0.3), y: n.y });
    nodeIdx.push(pts.length - 1);
    if (i < nodes.length - 1) {
      // The cross-over between two nodes: swing to the OPPOSITE side of the
      // node we just left. This is what turns a wobble into a serpentine.
      pts.push({
        x: cx - n.side * amp * (0.45 + rand() * 0.3),
        y: (n.y + nodes[i + 1].y) / 2,
      });
    }
  }

  const last = nodes[nodes.length - 1];
  pts.push({
    x: cx - last.side * amp * (0.3 + rand() * 0.2),
    y: (last.y + vineBottomY) / 2,
  });
  pts.push({ x: cx, y: vineBottomY });

  /* ---- 2. split into one segment per node, C1-continuous across the joints -- */

  const bounds = [0, ...nodeIdx, pts.length - 1];
  const segmentDs: string[] = [];
  for (let s = 0; s < bounds.length - 1; s += 1) {
    segmentDs.push(catmullRomSubPath(pts, bounds[s], bounds[s + 1]));
  }

  /* ---- 3. measure, then decorate ------------------------------------------- */

  const built = withMeasuredPaths(segmentDs, (paths) => {
    const segments: VineSegment[] = paths.map((path, i) => {
      const length = path.getTotalLength();
      const samples = sampleSegment(path, length);
      return {
        d: segmentDs[i],
        length,
        y0: samples[0].y,
        y1: samples[samples.length - 1].y,
        samples,
      };
    });

    const leafSpecs: {
      len: number;
      wid: number;
      transform: string;
      atY: number;
    }[] = [];
    const tendrilSpecs: { d: string; atY: number }[] = [];
    let alternate = 0;

    for (let s = 0; s < paths.length; s += 1) {
      const path = paths[s];
      const L = segments[s].length;

      const leafCount = Math.floor(L / VINE_LEAF_SPACING);
      for (let k = 0; k < leafCount; k += 1) {
        const at = clamp(
          ((k + 0.5) / leafCount + (rand() - 0.5) * 0.12) * L,
          2,
          L - 2,
        );
        const p = path.getPointAtLength(at);
        const q = path.getPointAtLength(Math.min(at + 1.5, L));
        const tangent = Math.atan2(q.y - p.y, q.x - p.x);
        alternate += 1;
        const side: Side = alternate % 2 === 0 ? 1 : -1;
        const jitter = (rand() - 0.5) * 2 * VINE_LEAF_ANGLE_JITTER_DEG;
        const angle = tangent + side * (VINE_LEAF_ANGLE_DEG + jitter) * DEG;
        const len = VINE_LEAF_LEN * (0.75 + rand() * 0.5);
        const wid = VINE_LEAF_WIDTH * (0.8 + rand() * 0.4) * side;
        leafSpecs.push({
          len,
          wid,
          transform: `translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(angle / DEG)})`,
          atY: p.y,
        });
      }

      const tendrilCount = Math.floor(L / VINE_TENDRIL_SPACING);
      for (let k = 0; k < tendrilCount; k += 1) {
        const at = clamp(((k + 0.5) / tendrilCount) * L + (rand() - 0.5) * 60, 2, L - 2);
        const p = path.getPointAtLength(at);
        const q = path.getPointAtLength(Math.min(at + 1.5, L));
        const tangent = Math.atan2(q.y - p.y, q.x - p.x);
        const side: Side = rand() > 0.5 ? 1 : -1;
        const angle = tangent + side * VINE_TENDRIL_ANGLE_DEG * DEG;
        tendrilSpecs.push({
          d: curlPath(
            p.x,
            p.y,
            angle,
            VINE_TENDRIL_LEN * (0.8 + rand() * 0.45),
            side * VINE_TENDRIL_CURL_DEG * DEG,
            VINE_TENDRIL_STEPS,
          ),
          atY: p.y,
        });
      }
    }

    const nodeAnchors: VineNodeAnchor[] = nodes.map((n, i) => {
      const point = pts[nodeIdx[i]];
      const anchor = { x: n.innerX, y: n.y };
      return {
        point,
        anchor,
        branchD: branchPath(point, anchor),
        branchLength: 0, // filled in by the second measuring pass
        atY: point.y,
        side: n.side,
      };
    });

    return { segments, leafSpecs, tendrilSpecs, nodeAnchors };
  });

  /* ---- 4. second measuring pass: leaf / tendril / branch lengths ------------ */

  const leafDs = built.leafSpecs.map((l) => leafPath(l.len, l.wid));
  const tendrilDs = built.tendrilSpecs.map((t) => t.d);
  const branchDs = built.nodeAnchors.map((n) => n.branchD);
  const decorDs = [...leafDs, ...tendrilDs, ...branchDs];

  const decorLengths = decorDs.length
    ? withMeasuredPaths(decorDs, (paths) => paths.map((p) => p.getTotalLength()))
    : [];

  const leaves: VineLeaf[] = built.leafSpecs.map((spec, i) => ({
    d: leafDs[i],
    rib: leafRibPath(spec.len, spec.wid),
    length: decorLengths[i] ?? 0,
    transform: spec.transform,
    atY: spec.atY,
  }));

  const tendrils: VineTendril[] = built.tendrilSpecs.map((spec, i) => ({
    d: spec.d,
    length: decorLengths[leafDs.length + i] ?? 0,
    atY: spec.atY,
  }));

  const nodeAnchors: VineNodeAnchor[] = built.nodeAnchors.map((n, i) => ({
    ...n,
    branchLength: decorLengths[leafDs.length + tendrilDs.length + i] ?? 0,
  }));

  return {
    layout,
    width,
    height,
    viewBox: `0 ${r2(vineTopY)} ${r2(width)} ${r2(height - vineTopY)}`,
    svgHeight: height + VINE_OVERHANG,
    svgTop: -VINE_OVERHANG,
    origin: { x: cx, y: vineTopY },
    vineTopY,
    vineBottomY,
    segments: built.segments,
    leaves,
    tendrils,
    nodes: nodeAnchors,
  };
}

/** Re-exported so the component does not need to import from vine-theme too. */
export { VINE_ANCHOR_INSET };
