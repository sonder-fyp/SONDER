import { cn } from "@/lib/utils";

/**
 * Vertical rhythm. Content is separated by space and hairline rules, never by
 * boxes. `bordered` draws the rule; `muted` alternates the ground.
 */
export function Section({
  size = "default",
  bordered = false,
  muted = false,
  children,
  className,
  ...rest
}: {
  size?: "compact" | "tight" | "default" | "hero";
  bordered?: boolean;
  muted?: boolean;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<"section">, "children" | "className">) {
  return (
    <section
      className={cn(
        size === "compact" && "py-10 md:py-12",
        size === "tight" && "py-16 md:py-20",
        size === "default" && "py-20 md:py-28",
        size === "hero" && "py-28 md:py-40",
        bordered && "border-t border-border",
        muted && "bg-muted",
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  );
}
