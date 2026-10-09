import { cn } from "@/lib/utils";

export type VerificationKind = "computed" | "ai-proposed";

/**
 * Where a value came from. "Computed" is a deterministic rule and is
 * trustworthy on its own. "AI-proposed" is a model suggestion that still needs
 * a human to validate it. BLUEPRINT section 7 requires the two never look the
 * same, so they take the two different accents plus different words.
 */
export function VerificationTag({
  kind,
  className,
}: {
  kind: VerificationKind;
  className?: string;
}) {
  const computed = kind === "computed";
  return (
    <span
      className={cn(
        "label inline-flex items-center gap-2.5",
        computed ? "text-accent" : "text-attention",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("h-0.5 w-4 shrink-0", computed ? "bg-accent" : "bg-attention")}
      />
      {computed ? "Computed" : "AI proposed"}
    </span>
  );
}
