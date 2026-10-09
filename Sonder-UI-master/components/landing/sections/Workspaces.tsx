"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container, Section } from "@/components/layout";
import { Label, LayeredNumber } from "@/components/type";
import { useSession, type Role } from "@/lib/session";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { useReveal } from "../useReveal";

/** The claim each workspace proves. Chrome copy, not fixture data. */
const CLAIM: Record<Role, string> = {
  student: "A question chosen to tell two ideas apart.",
  teacher: "Every diagnosis arrives with its evidence.",
  parent: "Nothing is shown before a teacher approves it.",
  admin: "When the bank falls short, it writes new questions.",
};

export function Workspaces() {
  const ref = useReveal<HTMLElement>();
  const { signIn } = useSession();

  return (
    <Section ref={ref} id="workspaces" size="hero" bordered>
      <Container>
        <Label tone="accent" data-reveal>
          Enter
        </Label>
        <h2
          data-reveal
          className="mt-8 max-w-[18ch] text-4xl font-semibold leading-tight tracking-tighter sm:text-5xl lg:text-6xl"
        >
          Four workspaces. One engine.
        </h2>

        <div className="mt-20 border-t border-border">
          {ROLE_ORDER.map((role, i) => {
            const meta = ROLES[role];
            return (
              <Link
                key={role}
                href={meta.home}
                onClick={() => signIn(role)}
                data-reveal
                className="group relative flex flex-col gap-6 border-b border-border py-10 transition-colors duration-150 ease-[var(--ease)] hover:border-border-hover lg:grid lg:grid-cols-12 lg:items-baseline lg:gap-12"
              >
                <LayeredNumber
                  value={String(i + 1).padStart(2, "0")}
                  className="-top-6 right-0 opacity-60"
                />

                <div className="lg:col-span-3">
                  <Label tone="accent" as="span">
                    {meta.label}
                  </Label>
                  <span className="mt-3 block text-sm text-muted-foreground">
                    {meta.person}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {meta.context}
                  </span>
                </div>

                <div className="lg:col-span-6">
                  <span className="relative inline-block text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
                    {CLAIM[role]}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-2 h-0.5 origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
                    />
                  </span>
                  <span className="mt-4 block max-w-xl text-base text-muted-foreground">
                    {meta.blurb}
                  </span>
                </div>

                <span className="label flex items-center gap-3 text-accent lg:col-span-3 lg:justify-end">
                  {meta.home}
                  <ArrowRight
                    className="size-4 shrink-0 transition-transform duration-150 ease-[var(--ease)] group-hover:translate-x-1"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
