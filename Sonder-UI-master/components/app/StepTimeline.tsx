"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The stepper for the evidence panel and the generation run. Every node is its
 * own button, so a reader jumps straight to the step they want; the chevrons
 * stay for fine stepping and for keyboards.
 *
 * Sticky under the top bar, on the page ground with a hairline. Not glass:
 * there is no glass in this build.
 */
export function StepTimeline({
  total,
  current,
  onStepChange,
  label = "Steps",
  stepNoun = "Step",
  className,
}: {
  total: number;
  current: number;
  onStepChange: (index: number) => void;
  label?: string;
  stepNoun?: string;
  className?: string;
}) {
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);

  function go(next: number) {
    const clamped = Math.min(total - 1, Math.max(0, next));
    if (clamped === current) return;
    onStepChange(clamped);
    nodes.current[clamped]?.focus();
  }

  return (
    <div
      className={cn(
        "sticky top-[var(--topbar-h)] z-20 border-b border-border bg-background",
        className,
      )}
    >
      <div className="flex items-center gap-6 py-4">
        <span className="label hidden shrink-0 text-muted-foreground sm:block">
          {stepNoun}
        </span>

        <div
          role="tablist"
          aria-label={label}
          aria-orientation="horizontal"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); go(current + 1); }
            else if (e.key === "ArrowLeft") { e.preventDefault(); go(current - 1); }
            else if (e.key === "Home") { e.preventDefault(); go(0); }
            else if (e.key === "End") { e.preventDefault(); go(total - 1); }
          }}
          className="app-scroll flex min-w-0 flex-1 items-center overflow-x-auto"
        >
          {Array.from({ length: total }, (_, i) => (
            <div key={i} className="flex min-w-0 flex-1 items-center last:flex-none">
              <button
                ref={(el) => { nodes.current[i] = el; }}
                type="button"
                role="tab"
                aria-label={`${stepNoun} ${i + 1} of ${total}`}
                aria-selected={i === current}
                aria-current={i === current ? "step" : undefined}
                tabIndex={i === current ? 0 : -1}
                onClick={() => go(i)}
                className="grid h-11 shrink-0 place-items-center px-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block transition-all duration-150 ease-[var(--ease)] motion-reduce:transition-none",
                    i === current && "h-1 w-8 bg-accent",
                    i < current && "size-1.5 bg-accent",
                    i > current && "size-1.5 border border-border-strong",
                  )}
                />
              </button>
              {i < total - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "h-px min-w-3 flex-1",
                    i < current ? "bg-accent" : "bg-border",
                  )}
                />
              ) : null}
            </div>
          ))}
        </div>

        <span className="label nums shrink-0 text-muted-foreground">
          {current + 1} / {total}
        </span>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            aria-label={`Previous ${stepNoun.toLowerCase()}`}
            className="grid size-11 place-items-center text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === total - 1}
            aria-label={`Next ${stepNoun.toLowerCase()}`}
            className="grid size-11 place-items-center text-muted-foreground transition-colors duration-150 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
