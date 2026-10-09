"use client";

import { cn } from "@/lib/utils";

/**
 * A dense selectable row. Selection is a 2px accent rule on the left edge plus
 * a muted ground, never a colour wash alone. Hover gets its own rule, in
 * `--border-strong`, so a hoverable row is distinguishable from a resting one
 * before it is committed to — never a fill alone.
 */
export function ListRow({
  leading,
  title,
  meta,
  trailing,
  selected = false,
  onSelect,
  className,
}: {
  /** A StatusMark glyph, an index, or a mono code. Optional. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Right-aligned: a date, a score, a chevron. */
  trailing?: React.ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 transition-colors duration-150 ease-[var(--ease)]",
          selected ? "bg-accent" : "bg-transparent group-hover:bg-border-strong",
        )}
      />
      <span className="flex min-w-0 flex-1 items-start gap-4">
        {leading ? <span className="mt-0.5 shrink-0">{leading}</span> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-base font-medium leading-snug">{title}</span>
          {meta ? (
            <span className="mt-2 block text-sm text-muted-foreground">{meta}</span>
          ) : null}
        </span>
      </span>
      {trailing ? (
        <span className="label shrink-0 pt-1 text-muted-foreground">{trailing}</span>
      ) : null}
    </>
  );

  const shape = cn(
    "group relative flex w-full min-h-16 items-start justify-between gap-6",
    "border-b border-border py-5 pl-5 pr-2 text-left",
    "transition-colors duration-150 ease-[var(--ease)]",
    selected ? "bg-muted" : "hover:bg-muted",
    className,
  );

  if (!onSelect) return <div className={shape}>{inner}</div>;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={shape}
    >
      {inner}
    </button>
  );
}
