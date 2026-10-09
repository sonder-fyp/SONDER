import { cn } from "@/lib/utils";

/**
 * The system's signature anchor: a 2px x 64px accent rule. Sits under a
 * masthead headline and above a highlighted block. Purely decorative, so it is
 * aria-hidden.
 */
export function AccentBar({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-0.5 w-16 bg-accent", className)} />;
}
