"use client";

import Link from "next/link";
import { Container, Section } from "@/components/layout";
import { Label } from "@/components/type";
import { BrandMark } from "@/components/app/BrandMark";
import { useReveal } from "../useReveal";

const WALK = [
  { href: "/student", label: "Student" },
  { href: "/teacher", label: "Teacher" },
  { href: "/parent", label: "Parent" },
  { href: "/admin", label: "Admin" },
  { href: "/dev/components", label: "Component gallery" },
];

export function LandingFooter() {
  const ref = useReveal<HTMLElement>();
  return (
    <footer ref={ref} role="contentinfo" className="border-t border-border">
      <Section size="tight">
        <Container>
          <div className="grid gap-16 md:grid-cols-12 md:gap-12">
            <div data-reveal className="md:col-span-5">
              <span className="inline-flex text-accent">
                <BrandMark size={36} />
              </span>
              <p className="mt-8 max-w-[34ch] text-base leading-relaxed text-muted-foreground">
                Final-year project. Adaptive misconception diagnosis across Maths,
                Physics and Chemistry.
              </p>
            </div>

            <div data-reveal className="md:col-span-3">
              <Label tone="muted">Walk the build</Label>
              <div className="mt-6 flex flex-col">
                {WALK.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group relative w-fit py-2 text-base text-muted-foreground transition-colors duration-150 hover:text-foreground"
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-1 h-px origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
                    />
                  </Link>
                ))}
              </div>
            </div>

            <div data-reveal className="md:col-span-4">
              <Label tone="muted">Notes</Label>
              <div className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
                <p>Scripted data. No backend, no authentication, no live model.</p>
                <p>3D model generated with Tripo AI. See the licence notes in the README.</p>
                <p>Built with Next.js, three.js and GSAP.</p>
              </div>
            </div>
          </div>

          <p className="label mt-20 border-t border-border pt-8 text-faint">
            Sonder · Proof of concept {new Date().getFullYear()}
          </p>
        </Container>
      </Section>
    </footer>
  );
}
