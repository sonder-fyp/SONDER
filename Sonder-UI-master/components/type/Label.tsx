import { cn } from "@/lib/utils";

/**
 * The micro-type signature: mono, uppercase, 0.2em tracking, 15px.
 * Used wherever a label is not a sentence. Never for prose.
 *
 * `tone` maps to the four status buckets in the plan, part 2.3.
 */
export function Label({
  children,
  tone = "muted",
  as: Tag = "p",
  className,
  ...rest
}: {
  children: React.ReactNode;
  tone?: "muted" | "accent" | "attention" | "foreground" | "faint";
  as?: "p" | "span" | "div" | "h2" | "h3" | "dt";
  className?: string;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className">) {
  return (
    <Tag
      className={cn(
        "label",
        tone === "muted" && "text-muted-foreground",
        tone === "accent" && "text-accent",
        tone === "attention" && "text-attention",
        tone === "foreground" && "text-foreground",
        tone === "faint" && "text-faint",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
