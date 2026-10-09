"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  buildVineGeometry,
  lengthAtY,
  type NodeMeasurement,
  type Side,
  type VineGeometry,
} from "@/lib/landing/vine/geometry";
import { VINE_NODES, type VineNode } from "@/lib/landing/vine/content";
import {
  VINE_ANCHOR_INSET,
  VINE_BRANCH_GAP,
  VINE_FRONT_VH,
  VINE_HYSTERESIS,
  VINE_NODE_LEAD,
  VINE_OVERHANG,
  VINE_RAIL_BREAKPOINT,
  VINE_SCRUB,
  VINE_WRITE_EPSILON,
} from "@/lib/landing/vine/vine-theme";
import { useIsomorphicLayoutEffect } from "@/lib/useIsomorphicLayoutEffect";
import "./styles/vine.css";

gsap.registerPlugin(ScrollTrigger);

type VineScrollerProps = {
  nodes?: VineNode[];
  className?: string;
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Rail layout puts every card on the right of the rail; centred layout alternates. */
function sideFor(index: number, layoutIsRail: boolean): Side {
  if (layoutIsRail) return 1;
  return index % 2 === 0 ? -1 : 1;
}

export default function VineScroller({ nodes = VINE_NODES, className }: VineScrollerProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  /** Last measurement, so a ResizeObserver that fires with identical numbers is a no-op. */
  const lastMeasureRef = useRef<string>("");
  const [geom, setGeom] = useState<VineGeometry | null>(null);
  const [ready, setReady] = useState(false);

  /* -------------------------------------------------------------- measure */

  const measure = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;

    const width = section.clientWidth;
    const height = section.offsetHeight;
    if (width <= 0 || height <= 0) return;

    const railed = width < VINE_RAIL_BREAKPOINT;

    // offsetTop/offsetLeft, NOT getBoundingClientRect: the cards carry a
    // translateY() while hidden and rect maths would include it.
    const measurements: NodeMeasurement[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = cardRefs.current[i];
      if (!el) return; // not laid out yet; a later ResizeObserver tick will retry
      const side = sideFor(i, railed);
      const y = el.offsetTop + VINE_ANCHOR_INSET;
      const innerX =
        side === -1
          ? el.offsetLeft + el.offsetWidth + VINE_BRANCH_GAP
          : el.offsetLeft - VINE_BRANCH_GAP;
      measurements.push({ y, innerX, side });
    }

    const key = `${width}x${height}|${measurements
      .map((m) => `${Math.round(m.y)},${Math.round(m.innerX)},${m.side}`)
      .join(";")}`;
    if (key === lastMeasureRef.current) return;
    lastMeasureRef.current = key;

    setGeom(buildVineGeometry(width, height, measurements));
    setReady(true);
  }, [nodes.length]);

  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    // The vine <svg> is absolutely positioned, so rendering it cannot change the
    // section's size — this observer cannot feed itself.
    const ro = new ResizeObserver(schedule);
    ro.observe(section);
    cardRefs.current.forEach((el) => el && ro.observe(el));

    // Web fonts landing late change card heights.
    if (document.fonts?.ready) void document.fonts.ready.then(schedule);

    return () => {
      ro.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [measure]);

  /* -------------------------------------------------- growth (ScrollTrigger) */

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const svg = svgRef.current;
    if (!geom || !section || !svg || geom.segments.length === 0) return;

    const segGroups = Array.from(svg.querySelectorAll<SVGGElement>("[data-seg]"));
    const openables = Array.from(svg.querySelectorAll<SVGGElement>("[data-at]"));
    const openableAt = openables.map((el) => Number(el.dataset.at));
    const cards = cardRefs.current.slice(0, geom.nodes.length);

    // Dash array is constant per segment — write it once, never per frame.
    segGroups.forEach((g, i) => {
      const seg = geom.segments[i];
      if (!seg) return;
      g.style.strokeDasharray = `${seg.length}`;
    });

    const lastOffset = new Array<number>(segGroups.length).fill(Number.NaN);
    const openState = new Array<boolean>(openables.length).fill(false);
    const cardState = new Array<boolean>(cards.length).fill(false);

    const applyFront = (frontY: number) => {
      for (let s = 0; s < segGroups.length; s += 1) {
        const seg = geom.segments[s];
        const g = segGroups[s];
        if (!seg || !g) continue;
        const drawn = lengthAtY(seg, frontY);
        const offset = seg.length - drawn;
        if (Math.abs(offset - lastOffset[s]) < VINE_WRITE_EPSILON) continue;
        lastOffset[s] = offset;
        g.style.strokeDashoffset = `${offset}`;
      }

      for (let i = 0; i < openables.length; i += 1) {
        const at = openableAt[i];
        const want = openState[i] ? frontY >= at - VINE_HYSTERESIS : frontY >= at;
        if (want === openState[i]) continue;
        openState[i] = want;
        openables[i].classList.toggle("is-open", want);
      }

      for (let i = 0; i < cards.length; i += 1) {
        const el = cards[i];
        if (!el) continue;
        const at = geom.nodes[i].atY - VINE_NODE_LEAD;
        const want = cardState[i] ? frontY >= at - VINE_HYSTERESIS : frontY >= at;
        if (want === cardState[i]) continue;
        cardState[i] = want;
        el.classList.toggle("is-visible", want);
      }
    };

    if (prefersReducedMotion()) {
      applyFront(geom.vineBottomY);
      return;
    }

    applyFront(geom.vineTopY);

    const travel = geom.vineBottomY - geom.vineTopY;
    const state = { p: 0 };

    // gsap.context scopes every tween and ScrollTrigger created inside it, so a
    // single revert() cleans up correctly under React StrictMode's double mount.
    const ctx = gsap.context(() => {
      gsap.to(state, {
        p: 1,
        ease: "none",
        onUpdate: () => applyFront(geom.vineTopY + state.p * travel),
        scrollTrigger: {
          trigger: section,
          start: () => `top ${window.innerHeight * VINE_FRONT_VH + VINE_OVERHANG}px`,
          end: () => `+=${travel}`,
          scrub: VINE_SCRUB,
          invalidateOnRefresh: true,
          // Lower than the hero pin's 1, so the pin is measured first and this
          // trigger's start accounts for the pin spacer. See hero-intro plan §12.1.
          refreshPriority: 0,
        },
      });
    }, section);

    ScrollTrigger.refresh();

    return () => {
      ctx.revert();
    };
  }, [geom]);

  /* -------------------------------------------------------------- render */

  const railed = geom ? geom.layout === "rail" : false;

  return (
    <section
      ref={sectionRef}
      className={`vine-scroller${className ? ` ${className}` : ""}`}
      data-ready={ready ? "true" : "false"}
      data-layout={geom?.layout ?? "center"}
    >
      {geom && (
        <svg
          ref={svgRef}
          className="vine-svg"
          style={{ top: geom.svgTop, height: geom.svgHeight }}
          viewBox={geom.viewBox}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* tendrils (behind) */}
          <g className="vine-tendrils">
            {geom.tendrils.map((t, i) => (
              <g
                key={`t${i}`}
                className="vine-tendril"
                data-at={t.atY}
                style={{ "--vine-len": t.length } as CSSProperties}
              >
                <path className="vine-tendril-core" d={t.d} />
              </g>
            ))}
          </g>

          {/* leaves (behind the spine) */}
          <g className="vine-leaves">
            {geom.leaves.map((l, i) => (
              <g key={`l${i}`} transform={l.transform}>
                <g
                  className="vine-leaf"
                  data-at={l.atY}
                  style={{ "--vine-len": l.length } as CSSProperties}
                >
                  <path className="vine-leaf-body" d={l.d} />
                  <path className="vine-leaf-rib" d={l.rib} />
                </g>
              </g>
            ))}
          </g>

          {/* the spine. stroke-dasharray / -dashoffset are set on the <g> and
              INHERIT down to all five layer paths — one style write per segment. */}
          <g className="vine-spine">
            {geom.segments.map((seg, i) => (
              <g key={`s${i}`} data-seg={i} className="vine-seg">
                <path className="vine-spine-line" d={seg.d} />
              </g>
            ))}
          </g>

          {/* branches + knots */}
          <g className="vine-branches">
            {geom.nodes.map((n, i) => (
              <g
                key={`b${i}`}
                className="vine-branch"
                data-at={n.atY}
                style={{ "--vine-len": n.branchLength } as CSSProperties}
              >
                <path className="vine-branch-core" d={n.branchD} />
                <circle className="vine-knot-ring" cx={n.point.x} cy={n.point.y} r={6.5} />
                <circle className="vine-knot-dot" cx={n.point.x} cy={n.point.y} r={2.4} />
                <circle className="vine-tip" cx={n.anchor.x} cy={n.anchor.y} r={3} />
              </g>
            ))}
          </g>
        </svg>
      )}

      <div className="vine-rows">
        {nodes.map((node, i) => (
          <div
            className="vine-row"
            key={node.id}
            data-side={sideFor(i, railed) === -1 ? "left" : "right"}
          >
            <article
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              id={`vine-node-${node.id}`}
              className="vine-node"
            >
              <p className="vine-node-index">{String(i + 1).padStart(2, "0")}</p>
              <p className="vine-node-eyebrow">{node.eyebrow}</p>
              <h2 className="vine-node-title">{node.title}</h2>
              <p className="vine-node-body">{node.body}</p>
              {node.meta ? (
                <p className="vine-node-meta">{node.meta}</p>
              ) : null}
            </article>
          </div>
        ))}
      </div>

      <div className="vine-tail" aria-hidden="true" />
    </section>
  );
}
