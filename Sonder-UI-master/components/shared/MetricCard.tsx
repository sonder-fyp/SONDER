import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/type";

type Direction = "up" | "down" | "flat";

/**
 * One headline number with the comparison that gives it meaning. BLUEPRINT
 * feature 20: performance is always reported against a baseline, never alone.
 * `goodWhen` is per metric: fewer questions is good, higher accuracy is good.
 */
export function MetricCard({
  label,
  value,
  comparisonLabel,
  comparisonValue,
  direction,
  goodWhen = "up",
  className,
}: {
  label: string;
  value: string;
  comparisonLabel: string;
  comparisonValue?: string;
  direction?: Direction;
  goodWhen?: "up" | "down";
  className?: string;
}) {
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  const favourable = direction && direction !== "flat" && direction === goodWhen;
  const tone = !direction || direction === "flat"
    ? "text-muted-foreground"
    : favourable
      ? "text-accent"
      : "text-attention";

  return (
    <div className={cn("border-t border-border pt-8", className)}>
      <Label tone="muted">{label}</Label>
      <p className="nums mt-6 font-mono text-5xl leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-6 flex items-baseline gap-2 text-sm">
        {direction ? (
          <Icon className={cn("size-4 shrink-0 self-center", tone)} strokeWidth={1.5} aria-hidden />
        ) : null}
        <span className={cn("nums font-medium", tone)}>{comparisonValue}</span>
        <span className="text-muted-foreground">{comparisonLabel}</span>
      </p>
      <span className="sr-only">
        {favourable ? "Favourable against the baseline." : "Not favourable against the baseline."}
      </span>
    </div>
  );
}
