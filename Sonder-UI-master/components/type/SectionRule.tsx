import { cn } from "@/lib/utils";

/**
 * A named block starts here: a decorative hairline with the 2px x 64px accent
 * tick on the left. Not a box. aria-hidden because it is structure, not content.
 */
export function SectionRule({ className }: { className?: string }) {
  return (
    <div
      data-slot="section-rule"
      aria-hidden
      className={cn("relative h-px bg-border", className)}
    >
      <span className="absolute left-0 top-0 h-0.5 w-16 bg-accent" />
    </div>
  );
}
