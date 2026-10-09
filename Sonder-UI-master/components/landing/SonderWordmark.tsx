"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import {
  SONDER_GLYPHS,
  crosshair,
  guideRectBottom,
  guideRectTop,
} from "@/lib/landing/hero/wordmark-glyphs";
import {
  WM_BAND_H,
  WM_BREAK_MD,
  WM_BREAK_SM,
  WM_CROSS_ARM,
  WM_CROSS_Y,
  WM_DELAY,
  WM_GLYPH_DUR,
  WM_GLYPH_STAGGER,
  WM_GLYPH_START,
  WM_GLYPH_TOP,
  WM_GLYPH_W,
  WM_GUIDE_BOT_H,
  WM_GUIDE_BOT_Y,
  WM_GUIDE_DUR,
  WM_GUIDE_INDICES,
  WM_GUIDE_STAGGER,
  WM_GUIDE_TOP_H,
  WM_GUIDE_TOP_Y,
  WM_PAD,
  WM_RULE_BASE_Y,
  WM_RULE_CAP_Y,
  WM_TRACKING_LG,
  WM_TRACKING_MD,
  WM_TRACKING_SM,
} from "@/lib/landing/hero/hero-theme";
import { useIsomorphicLayoutEffect } from "@/lib/useIsomorphicLayoutEffect";

function trackingFor(width: number) {
  if (width < WM_BREAK_SM) return WM_TRACKING_SM;
  if (width < WM_BREAK_MD) return WM_TRACKING_MD;
  return WM_TRACKING_LG;
}

/**
 * "SONDER" drawn as a technical pen drawing: hairline geometric capitals on a
 * blueprint of construction guides, drawn one pen stroke at a time on load.
 *
 * Every stroke is wrapped in a <g data-draw>: stroke-dasharray and
 * stroke-dashoffset are INHERITED SVG properties, so one style write on the group
 * animates both the glow layer and the core layer together.
 */
export default function SonderWordmark() {
  const svgRef = useRef<SVGSVGElement>(null);
  // Always start at the desktop tracking so server and client render an identical viewBox,
  // then correct on mount. The one-frame change is invisible: the draw-on has not started
  // yet (WM_DELAY is 0.35s).
  const [tracking, setTracking] = useState(WM_TRACKING_LG);

  useEffect(() => {
    const apply = () => setTracking(trackingFor(window.innerWidth));
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  const advance = WM_GLYPH_W + tracking;
  const contentW = SONDER_GLYPHS.length * WM_GLYPH_W + (SONDER_GLYPHS.length - 1) * tracking;
  const viewW = contentW + WM_PAD * 2;
  const glyphX = (i: number) => WM_PAD + i * advance;
  const centreX = viewW / 2;

  useIsomorphicLayoutEffect(() => {
    const root = svgRef.current;
    if (!root) return;

    const groups = Array.from(root.querySelectorAll<SVGGElement>("[data-draw]"));
    if (!groups.length) return;

    // Measure each group's first <path> — every layer inside a group shares one `d`,
    // so one measurement is correct for all of them.
    const primed = groups.map((g) => {
      const path = g.querySelector("path");
      const len = path ? path.getTotalLength() : 0;
      g.style.strokeDasharray = `${len}`;
      g.style.strokeDashoffset = `${len}`;
      return g;
    });

    /** Clearing the dash once drawn removes a whole class of resize bug: a stale
     *  dasharray with a longer path would leave the tail of the stroke in a gap. */
    const clearDash = () => {
      primed.forEach((g) => {
        g.style.strokeDasharray = "none";
        g.style.strokeDashoffset = "0";
      });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      clearDash();
      return;
    }

    const ctx = gsap.context(() => {
      const guides = primed.filter((g) => g.dataset.draw === "guide");
      const glyphs = primed.filter((g) => g.dataset.draw === "glyph");

      gsap
        .timeline({ delay: WM_DELAY, onComplete: clearDash })
        .to(
          guides,
          {
            strokeDashoffset: 0,
            duration: WM_GUIDE_DUR,
            ease: "power2.out",
            stagger: WM_GUIDE_STAGGER,
          },
          0,
        )
        .to(
          glyphs,
          {
            strokeDashoffset: 0,
            duration: WM_GLYPH_DUR,
            ease: "power2.inOut",
            stagger: WM_GLYPH_STAGGER,
          },
          WM_GLYPH_START,
        );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <svg
      ref={svgRef}
      className="wm-svg"
      viewBox={`0 0 ${viewW} ${WM_BAND_H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Sonder"
    >
      {/* ------------------------------------------------------------ guides */}
      <g className="wm-guides">
        <g className="wm-stroke" data-draw="guide" transform={`translate(${centreX} ${WM_CROSS_Y})`}>
          <path className="wm-guide-line" d={crosshair(WM_CROSS_ARM)} />
        </g>

        <g className="wm-stroke" data-draw="guide" transform={`translate(${WM_PAD} ${WM_RULE_CAP_Y})`}>
          <path className="wm-guide-line" d={`M 0 0 L ${contentW} 0`} />
        </g>
        <g className="wm-stroke" data-draw="guide" transform={`translate(${WM_PAD} ${WM_RULE_BASE_Y})`}>
          <path className="wm-guide-line" d={`M 0 0 L ${contentW} 0`} />
        </g>

        {WM_GUIDE_INDICES.map((i) => (
          <g
            key={`gt${i}`}
            className="wm-stroke"
            data-draw="guide"
            transform={`translate(${glyphX(i)} ${WM_GUIDE_TOP_Y})`}
          >
            <path className="wm-guide-line" d={guideRectTop(WM_GLYPH_W, WM_GUIDE_TOP_H)} />
          </g>
        ))}
        {WM_GUIDE_INDICES.map((i) => (
          <g
            key={`gb${i}`}
            className="wm-stroke"
            data-draw="guide"
            transform={`translate(${glyphX(i)} ${WM_GUIDE_BOT_Y})`}
          >
            <path className="wm-guide-line" d={guideRectBottom(WM_GLYPH_W, WM_GUIDE_BOT_H)} />
          </g>
        ))}
      </g>

      {/* ------------------------------------------------------------ glyphs */}
      <g className="wm-glyphs">
        {SONDER_GLYPHS.map((glyph, i) => (
          <g key={glyph.char + i} transform={`translate(${glyphX(i)} ${WM_GLYPH_TOP})`}>
            {glyph.strokes.map((d, s) => (
              <g key={s} className="wm-stroke" data-draw="glyph">
                <path className="wm-core" d={d} />
              </g>
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
