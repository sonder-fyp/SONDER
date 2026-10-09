import { Label } from "@/components/type";
import { cn } from "@/lib/utils";

export type OutcomeType = "diagnosed" | "unsure";

/**
 * Diagnosed and unsure must read differently at a glance without relying on
 * colour: different rule weight, different label, different type treatment.
 *  - diagnosed: a 2px accent rule, accent label, the message in Playfair
 *  - unsure:    a 1px muted rule, muted label, the message in the sans stack
 */
export function OutcomeBanner({
  type,
  title,
  message,
  className,
}: {
  type: OutcomeType;
  title?: string;
  message: string;
  className?: string;
}) {
  const diagnosed = type === "diagnosed";
  return (
    <section
      role="status"
      className={cn(
        "pt-8",
        diagnosed ? "border-t-2 border-t-accent" : "border-t border-t-border-strong",
        className,
      )}
    >
      <Label tone={diagnosed ? "accent" : "muted"}>
        {title ?? (diagnosed ? "Misconception identified" : "Not sure yet")}
      </Label>
      <p
        className={cn(
          "mt-6 max-w-2xl",
          diagnosed
            ? "font-quote text-2xl leading-relaxed text-foreground sm:text-3xl"
            : "text-lg leading-relaxed text-muted-foreground",
        )}
      >
        {message}
      </p>
    </section>
  );
}
