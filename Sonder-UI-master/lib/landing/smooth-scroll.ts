/**
 * Document-level inertial scrolling (Lenis) wired to GSAP ScrollTrigger.
 * Skipped entirely when the user prefers reduced motion.
 */
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;
let onTick: ((time: number) => void) | null = null;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function initSmoothScroll() {
  if (lenis || prefersReducedMotion()) return;

  lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.1,
  });

  lenis.on("scroll", ScrollTrigger.update);

  // Official Lenis ↔ GSAP clock: ScrollTrigger and Lenis share one ticker.
  // Native window scroll is still updated, so VineScroller's scrub stays valid
  // without a scrollerProxy.
  onTick = (time: number) => {
    lenis?.raf(time * 1000);
  };
  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);
}

export function destroySmoothScroll() {
  if (onTick) {
    gsap.ticker.remove(onTick);
    onTick = null;
  }
  lenis?.destroy();
  lenis = null;
}

export function getLenis() {
  return lenis;
}
