"use client";

import { useEffect, useRef } from "react";

/**
 * Adds `is-revealed` to every [data-reveal] descendant as it enters the viewport, once.
 * Sets data-reveal-scope="ready" only after mount, so a no-JS render shows everything
 * (globals.css hides [data-reveal] only inside a ready scope).
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    targets.forEach((el, i) => el.style.setProperty("--reveal-i", String(i)));
    root.dataset.revealScope = "ready";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        });
      },
      { rootMargin: "0px 0px -50px 0px", threshold: 0.15 },
    );
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}
