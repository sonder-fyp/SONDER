"use client";

import { useState } from "react";
import Link from "next/link";
import type { VerificationCheck } from "@/fixtures/scenarios/types";
import { FocusFrame } from "@/components/layout";
import { Label } from "@/components/type";
import { OutcomeBanner } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VerifyClient({
  check,
}: {
  check: VerificationCheck;
}) {
  const [answered, setAnswered] = useState<string | null>(null);
  const held = answered === check.correctAnswer;

  return (
    <FocusFrame
      progress={{ current: answered ? 1 : 0, total: 1 }}
      exitHref="/student"
      exitLabel="Back to home"
    >
      <Label tone="accent">Follow-up check</Label>
      <p className="mt-8 text-lg text-muted-foreground">{check.context}</p>
      <h1 className="mt-10 text-3xl font-semibold leading-snug tracking-tight sm:text-4xl">
        {check.questionText}
      </h1>

      {!answered ? (
        <div className="mt-12 border-t border-border">
          {check.optionsShown.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => setAnswered(opt)}
              className={cn(
                "group relative flex min-h-16 w-full items-center gap-6 border-b border-border px-2 py-5 text-left text-lg transition-colors duration-150 ease-[var(--ease)] hover:bg-muted",
              )}
            >
              <span className="label nums w-6 shrink-0 text-faint">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      ) : (
        <>
          <OutcomeBanner
            type={held ? "diagnosed" : "unsure"}
            title={held ? "The fix held" : "This one slipped back"}
            message={
              held
                ? "Nothing more to do on this misconception for now."
                : "Your teacher has been notified and will revisit it with you."
            }
            className="mt-12"
          />
          <div className="mt-12">
            <Link href="/student" className={buttonVariants()}>
              Back to home
            </Link>
          </div>
        </>
      )}
    </FocusFrame>
  );
}
