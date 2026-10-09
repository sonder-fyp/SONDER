"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FocusFrame } from "@/components/layout";
import { Label, AccentBar } from "@/components/type";
import { Button } from "@/components/ui/button";
import { Mark } from "@/components/shared";
import { SUBJECTS, type Subject } from "@/fixtures/subjects";

export default function StartDiagnostic() {
  const [subject, setSubject] = useState<Subject | null>(null);

  return (
    <FocusFrame
      progress={{ current: subject ? 2 : 1, total: 2 }}
      exitHref="/student"
      exitLabel="Leave the picker"
    >
      {!subject ? (
        <>
          <Label tone="accent">Step one of two</Label>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
            Which subject?
          </h1>
          <AccentBar className="mt-8" />
          <div className="mt-12 border-t border-border">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSubject(s)}
                  className="group flex min-h-24 w-full items-center gap-6 border-b border-border text-left transition-colors duration-150 ease-[var(--ease)] hover:bg-muted"
                >
                  <Icon
                    className="size-6 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <span className="flex-1 text-3xl font-semibold tracking-tight">
                    {s.name}
                  </span>
                  <span className="label nums text-faint">{s.topics.length} topics</span>
                  <ArrowRight
                    className="size-4 shrink-0 translate-x-0 text-muted-foreground transition-transform duration-150 ease-[var(--ease)] group-hover:translate-x-1 group-hover:text-accent"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setSubject(null)}>
            Change subject
          </Button>
          <Label tone="accent" className="mt-8">
            Step two of two
          </Label>
          <h1 className="mt-8 text-4xl font-semibold tracking-tight sm:text-5xl">
            {subject.name}
          </h1>
          <AccentBar className="mt-8" />
          <div className="mt-12 border-t border-border">
            <Link
              href={`/student/session/${subject.generalScenario}/general`}
              className="group flex min-h-24 w-full flex-col justify-center border-b border-border py-6 text-left transition-colors duration-150 hover:bg-muted"
            >
              <Label tone="accent">Whole subject</Label>
              <span className="mt-3 text-2xl font-semibold tracking-tight">
                Broad check across all of {subject.name}
              </span>
            </Link>
            {subject.topics.map((topic) => {
              const wired = Boolean(topic.scenario);
              const inner = (
                <>
                  <span className="text-2xl font-semibold tracking-tight">{topic.name}</span>
                  <span className="mt-2 block text-base text-muted-foreground">{topic.blurb}</span>
                </>
              );
              if (!wired) {
                return (
                  <div
                    key={topic.id}
                    className="flex min-h-24 cursor-not-allowed items-center justify-between gap-6 border-b border-border py-6 opacity-50"
                  >
                    <div>{inner}</div>
                    <Mark bucket="inert">Not in this build</Mark>
                  </div>
                );
              }
              return (
                <Link
                  key={topic.id}
                  href={`/student/session/${topic.scenario}/topic`}
                  className="group flex min-h-24 flex-col justify-center border-b border-border py-6 transition-colors duration-150 hover:bg-muted"
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </FocusFrame>
  );
}
