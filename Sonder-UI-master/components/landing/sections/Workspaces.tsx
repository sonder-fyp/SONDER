"use client";
import Link from "next/link";
import { ArrowRight, BookOpen, ClipboardCheck } from "lucide-react";
import { Container, Section } from "@/components/layout";
import { Label } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { useReveal } from "../useReveal";

export function Workspaces() {
  const ref = useReveal<HTMLElement>();
  const { account, email } = useSession();
  return (
    <Section ref={ref} id="educators" size="hero" bordered>
      <Container>
        <Label tone="accent" data-reveal>
          Learning, together
        </Label>
        <h2
          data-reveal
          className="mt-8 max-w-[20ch] text-4xl font-semibold leading-tight tracking-tighter sm:text-5xl lg:text-6xl"
        >
          A clearer question.
          <br />A more useful next step.
        </h2>
        <div className="mt-16 grid gap-12 border-t border-border pt-10 md:grid-cols-2 md:gap-20">
          <div data-reveal>
            <BookOpen
              className="size-7 text-accent"
              strokeWidth={1.25}
              aria-hidden
            />
            <h3 className="mt-6 text-2xl font-semibold">Room to think.</h3>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
              Students work through one question at a time. Answers are saved,
              so a check can be continued later.
            </p>
          </div>
          <div data-reveal>
            <ClipboardCheck
              className="size-7 text-accent"
              strokeWidth={1.25}
              aria-hidden
            />
            <h3 className="mt-6 text-2xl font-semibold">
              Context for the teacher.
            </h3>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
              Sonder is being built to connect student answers with evidence for
              teacher review. Class and review tools will become available as
              they are completed.
            </p>
          </div>
        </div>
        <div
          data-reveal
          className="mt-16 border-y border-border py-10 md:flex md:items-center md:justify-between md:gap-12"
        >
          <div>
            <h3 className="text-2xl font-semibold">
              Begin with a little clarity.
            </h3>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Mathematics diagnostics are available to enrolled students.
              Teacher and parent registrations require approval.
            </p>
          </div>
          <Link
            href={account || email ? "/auth/continue" : "/auth/sign-up"}
            className={`${buttonVariants({ size: "lg" })} mt-8 shrink-0 md:mt-0`}
          >
            {account || email ? "Open dashboard" : "Create account"}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Container>
    </Section>
  );
}
