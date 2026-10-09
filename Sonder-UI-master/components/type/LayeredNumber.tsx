import { cn } from "@/lib/utils";

/**
 * Depth without shadows: an oversized numeral in --faint sitting behind
 * content. Hidden below `md` because a 160px glyph forces horizontal scroll on
 * a phone, which the design system calls out explicitly.
 */
export function LayeredNumber({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute -z-10 hidden select-none",
        "font-mono text-8xl leading-none tracking-tighter text-decorative md:block lg:text-9xl",
        className,
      )}
    >
      {value}
    </span>
  );
}
