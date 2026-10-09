"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SonderWordmark from "./SonderWordmark";
import { BrainViewer, type BrainViewerHandle } from "./BrainViewer";
import {
  HERO_ENTRY_END,
  HERO_PIN_VH,
  HERO_SCRUB,
  HERO_VEIL_OPACITY,
  HERO_WORDMARK_EXIT_END,
  HERO_WORDMARK_RISE_PCT,
} from "@/lib/landing/hero/hero-theme";
import {
  HERO_HEADLINE_ACCENT,
  HERO_HEADLINE_LEAD,
  HERO_KICKER,
} from "@/lib/landing/hero/copy";
import { useIsomorphicLayoutEffect } from "@/lib/useIsomorphicLayoutEffect";
import "./styles/hero-stage.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * The pinned hero.
 *
 * Owns everything that happens in the first screen: the brain viewer, the SONDER
 * wordmark, the exit veil, and the single scrubbed timeline that choreographs
 * them. Absorbs what used to be HeroScrollVeil — see plan section 7.1.
 * The Aether Flow backdrop lives at the App level (fixed, full page).
 */
export default function HeroStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const brainRef = useRef<BrainViewerHandle | null>(null);
  /** Latest entry progress, so a viewer that finishes loading mid-scroll can be
   *  brought straight to the correct pose instead of snapping in at p = 0. */
  const entryRef = useRef(0);

  const pushEntry = (p: number) => {
    entryRef.current = p;
    brainRef.current?.setEntryProgress(p);
    sectionRef.current?.style.setProperty("--brain-entry", String(p));
  };

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const veil = veilRef.current;
    const wordmark = wordmarkRef.current;
    if (!section || !veil || !wordmark) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // No pin, no scrub: the brain is simply already there and the wordmark is
      // already drawn. hero-stage.css lifts the wordmark clear of the brain in
      // this mode so the two do not overlap.
      section.dataset.motion = "reduced";
      pushEntry(1);
      gsap.set(leadRef.current, { opacity: 1, y: 0 });
      return;
    }

    pushEntry(0);

    const entry = { p: 0 };

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${window.innerHeight * HERO_PIN_VH}`,
          scrub: HERO_SCRUB,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // Must refresh BEFORE VineScroller's trigger, because the pin's spacer
          // shifts every subsequent element's document position. See plan §10.
          refreshPriority: 1,
        },
      });

      tl.to(
        entry,
        {
          p: 1,
          duration: HERO_ENTRY_END,
          onUpdate: () => pushEntry(entry.p),
          onComplete: () => pushEntry(1),
        },
        0,
      )
        .to(
          wordmark,
          {
            yPercent: -HERO_WORDMARK_RISE_PCT,
            opacity: 0,
            ease: "power1.in",
            duration: HERO_WORDMARK_EXIT_END,
          },
          0,
        )
        .to(
          veil,
          {
            opacity: HERO_VEIL_OPACITY,
            duration: 1 - HERO_ENTRY_END,
          },
          HERO_ENTRY_END,
        )
        .fromTo(
          leadRef.current,
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" },
          HERO_ENTRY_END - 0.1,
        );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="hero-stage ink-stage relative h-[100dvh] min-h-[100dvh] w-full"
    >
      {/* Short fade under the headline only. Kept below the brain and well
          below the SONDER wordmark so the wallpaper stays visible behind the title. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[4] h-[32vh] bg-gradient-to-t from-background via-background/70 to-transparent"
      />

      <BrainViewer
        className="relative z-[6] h-full w-full"
        entryAnimation
        autoRotate={false}
        showLoader={false}
        onViewerReady={(api) => {
          brainRef.current = api;
          // The viewer may finish loading long after the user has scrolled.
          api?.setEntryProgress(entryRef.current);
        }}
        showTip={false}
        showCaption={false}
        showToolRail={false}
        showAutoRotateToggle={false}
      />

      <div
        ref={veilRef}
        aria-hidden="true"
        className="hero-veil pointer-events-none absolute inset-0 z-[5]"
      />

      <div ref={wordmarkRef} className="hero-wordmark pointer-events-none absolute inset-0 z-[7]">
        <SonderWordmark />
      </div>

      <div
        ref={leadRef}
        className="hero-lead pointer-events-none absolute inset-x-0 bottom-0 z-[8]"
      >
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-8 px-6 pb-[8vh] pt-6 md:px-12 lg:flex-row lg:items-end lg:justify-between lg:px-16">
          <div className="min-w-0 max-w-[min(100%,28rem)]">
            <p className="label text-accent">{HERO_KICKER}</p>
            <h1 className="mt-5 text-[clamp(1.75rem,4vw,3.25rem)] font-semibold leading-[1.08] tracking-tighter">
              <span className="block">{HERO_HEADLINE_LEAD}{" "}</span>
              <span className="mt-1 block text-accent">{HERO_HEADLINE_ACCENT}</span>
            </h1>
          </div>

          <div className="pointer-events-auto shrink-0 lg:pb-2 lg:text-right">
            <p className="label text-muted-foreground">Scripted prototype</p>
            <p className="label mt-3 text-muted-foreground">No backend</p>
            <p className="label mt-3 text-muted-foreground">No live model</p>
            <a
              href="#narrative"
              className="label group relative mt-8 inline-flex min-h-11 items-center text-accent"
            >
              How it works
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-2 h-0.5 origin-center scale-x-100 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-110"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
