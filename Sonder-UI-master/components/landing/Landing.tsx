"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  HERO_HEADLINE_LEAD,
  HERO_HEADLINE_ACCENT,
  HERO_KICKER,
} from "@/lib/landing/hero/copy";
import { useEffect } from "react";
import { LANDING_CHROME_SENTINEL_ID } from "@/lib/chrome";
import { Thesis } from "./sections/Thesis";
import { Workspaces } from "./sections/Workspaces";
import { LandingFooter } from "./sections/LandingFooter";
import VineScroller from "./VineScroller";
import { Container } from "@/components/layout";
import {
  initSmoothScroll,
  destroySmoothScroll,
} from "@/lib/landing/smooth-scroll";
import "./styles/landing.css";

/**
 * The hero owns a WebGL context and a 2.5MB model, so it is a client-only
 * dynamic import and never blocks first paint. Everything else, including the
 * vine whose copy must be in the server HTML, renders normally.
 */
const HeroStage = dynamic(() => import("./HeroStage"), {
  ssr: false,
  // Exactly one dynamic viewport tall, on the page ground, so nothing shifts
  // when the real hero swaps in. This is the CLS defence.
  loading: () => (
    <div className="hero-stage ink-stage relative h-[100dvh] w-full">
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1440px] px-6 pb-[8vh] md:px-12 lg:px-16">
        <p className="label text-accent">{HERO_KICKER}</p>
        <h1 className="mt-5 max-w-lg text-3xl font-semibold leading-tight tracking-tighter sm:text-5xl">
          {HERO_HEADLINE_LEAD}
          <span className="mt-2 block text-accent">{HERO_HEADLINE_ACCENT}</span>
        </h1>
        <Link
          href="#narrative"
          className="mt-6 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4"
        >
          How it works
        </Link>
      </div>
    </div>
  ),
});

export function Landing() {
  useEffect(() => {
    initSmoothScroll();

    if (typeof document !== "undefined" && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        void import("gsap/ScrollTrigger").then((m) =>
          m.ScrollTrigger.refresh(),
        );
      });
    }

    return () => destroySmoothScroll();
  }, []);

  return (
    <div className="sonder-landing relative" id="top">
      <div
        id={LANDING_CHROME_SENTINEL_ID}
        aria-hidden
        className="pointer-events-none absolute left-0 top-[90vh] h-px w-px"
      />

      <main>
        <HeroStage />

        <Thesis />

        <section
          id="narrative"
          aria-label="How Sonder works"
          className="paper-band relative pt-40"
        >
          <Container>
            <p className="label text-paper-muted">The mechanism</p>
            <h2 className="mt-8 max-w-[20ch] text-4xl font-semibold leading-tight tracking-tighter text-paper-ink sm:text-5xl lg:text-6xl">
              From an answer to understanding.
            </h2>
          </Container>
          <VineScroller />
        </section>

        <Workspaces />
      </main>

      <LandingFooter />
    </div>
  );
}
