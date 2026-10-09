"use client";

import { Container, Section } from "@/components/layout";
import { Label, Quote } from "@/components/type";
import { useReveal } from "../useReveal";

export function Thesis() {
  const ref = useReveal<HTMLElement>();
  return (
    <Section ref={ref} id="premise" size="hero" bordered>
      <Container>
        <Label tone="accent" data-reveal>
          The premise
        </Label>

        <h2
          data-reveal
          className="mt-12 max-w-[14ch] text-5xl font-bold leading-none tracking-tighter sm:text-6xl md:text-7xl lg:text-8xl"
        >
          A wrong answer is not a diagnosis.
        </h2>

        <div className="mt-20 lg:grid lg:grid-cols-12 lg:gap-12">
          <div data-reveal className="lg:col-span-5 lg:col-start-8">
            <Quote cite="The problem Sonder exists to solve">
              The same wrong answer can come from four different broken ideas, and
              each one needs a different fix.
            </Quote>
          </div>
        </div>
      </Container>
    </Section>
  );
}
