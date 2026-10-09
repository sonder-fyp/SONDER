import { cn } from "@/lib/utils";

/**
 * A number that carries meaning: mono, tabular, large, with a wide-tracked
 * label underneath. Replaces every boxed metric tile in the old build. There is
 * no border, no background and no shadow: a 1px rule does the separating.
 */
export function Stat({
  value,
  label,
  hint,
  tone = "foreground",
  size = "default",
  className,
}: {
  value: React.ReactNode;
  label: string;
  hint?: string;
  tone?: "foreground" | "accent" | "attention" | "muted";
  size?: "default" | "large";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "nums font-mono leading-none tracking-tight",
          size === "large" ? "text-5xl sm:text-6xl" : "text-3xl sm:text-4xl",
          tone === "foreground" && "text-foreground",
          tone === "accent" && "text-accent",
          tone === "attention" && "text-attention",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="label mt-4 text-muted-foreground">{label}</p>
      {hint ? (
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
