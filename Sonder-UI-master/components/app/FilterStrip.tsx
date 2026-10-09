"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export type FilterOption<V extends string> = {
  value: V;
  label: string;
  count?: number;
};

/**
 * Radio-group semantics, not tabs: it changes the contents of one list rather
 * than which panel is shown. No pills, no segmented box: mono labels, with a
 * 2px accent rule under the selected one.
 */
export function FilterStrip<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: FilterOption<V>[];
  value: V;
  onChange: (next: V) => void;
  label: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  function move(delta: number) {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        else if (e.key === "Home") { e.preventDefault(); onChange(options[0].value); refs.current[0]?.focus(); }
        else if (e.key === "End") {
          e.preventDefault();
          const last = options.length - 1;
          onChange(options[last].value);
          refs.current[last]?.focus();
        }
      }}
      className={cn("app-scroll flex gap-8 overflow-x-auto", className)}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === index ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "label relative shrink-0 py-4 transition-colors duration-150 ease-[var(--ease)]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="inline-flex items-baseline gap-2">
              {option.label}
              {option.count !== undefined ? (
                <span className="nums text-faint">{option.count}</span>
              ) : null}
            </span>
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-150 ease-[var(--ease)]",
                active ? "scale-x-100 bg-accent" : "scale-x-0 bg-border-hover",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
