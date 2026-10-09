import { cn } from "@/lib/utils";

/**
 * The rare bounded container. Transparent fill, 1px border, sharp corners, no
 * shadow. Reach for a hairline rule and space before you reach for this.
 *
 * `highlighted` is the featured treatment: a 2px accent border and, by
 * convention at the call site, a small accent badge above it.
 */
export function Panel({
  highlighted = false,
  interactive = false,
  children,
  className,
  ...rest
}: {
  highlighted?: boolean;
  /** Adds the hover border-lightening transition. Use on links and buttons. */
  interactive?: boolean;
  children: React.ReactNode;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div
      className={cn(
        "bg-transparent p-6 md:p-8",
        highlighted ? "border-2 border-accent" : "border border-border",
        interactive &&
          "transition-colors duration-150 ease-[var(--ease)] hover:border-border-hover",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
