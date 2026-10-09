import Link from "next/link";
import { Stat } from "./Stat";
import { cn } from "@/lib/utils";

export type StatItem = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href?: string;
  tone?: "foreground" | "accent" | "attention" | "muted";
};

/**
 * A row of stats separated by vertical hairlines. Stacks to one column below
 * `sm`, where the hairlines become horizontal. This replaces the deleted
 * MetricStrip and, before it, StatTile.
 */
export function StatRow({
  items,
  className,
}: {
  items: StatItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 border-t border-border sm:grid-cols-2",
        items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        className,
      )}
    >
      {items.map((item) => {
        const cell = (
          <Stat
            value={item.value}
            label={item.label}
            hint={item.hint}
            tone={item.tone}
          />
        );
        const shape = cn(
          "border-b border-border py-8 sm:py-10",
          // First cell in each row sits flush; the rest carry the vertical rule.
          "sm:border-b-0 sm:border-l sm:border-border sm:px-8",
          "sm:[&:nth-child(2n+1)]:border-l-0 sm:[&:nth-child(2n+1)]:pl-0",
          items.length >= 4
            ? "lg:[&:nth-child(2n+1)]:border-l lg:[&:nth-child(2n+1)]:pl-8 lg:[&:nth-child(4n+1)]:border-l-0 lg:[&:nth-child(4n+1)]:pl-0"
            : "lg:[&:nth-child(2n+1)]:border-l lg:[&:nth-child(2n+1)]:pl-8 lg:[&:nth-child(3n+1)]:border-l-0 lg:[&:nth-child(3n+1)]:pl-0",
        );

        return item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(shape, "group block transition-colors hover:bg-muted")}
          >
            {cell}
          </Link>
        ) : (
          <div key={item.label} className={shape}>
            {cell}
          </div>
        );
      })}
    </div>
  );
}
