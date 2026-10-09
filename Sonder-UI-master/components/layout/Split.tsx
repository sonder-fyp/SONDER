import { cn } from "@/lib/utils";

/**
 * Asymmetric two-column layout. 7/5 and 8/4 only. Never 6/6: a symmetric split
 * is the one thing the design system explicitly rules out.
 *
 * `sticky` pins the secondary column with its own scroller and an explicit
 * max-height. A sticky column taller than the viewport is unreachable content,
 * so the max-height is mandatory, not optional.
 */
export function Split({
  ratio = "8/4",
  primary,
  secondary,
  sticky = false,
  secondaryFirstOnMobile = false,
  className,
}: {
  ratio?: "7/5" | "8/4" | "5/7" | "4/8";
  primary: React.ReactNode;
  secondary: React.ReactNode;
  sticky?: boolean;
  /** Put the secondary column above the primary on small screens. */
  secondaryFirstOnMobile?: boolean;
  className?: string;
}) {
  const [a, b] = ratio.split("/").map(Number);
  const primaryLeads = ratio === "7/5" || ratio === "8/4";

  return (
    <div className={cn("lg:grid lg:grid-cols-12 lg:gap-12", className)}>
      <div
        className={cn(
          "min-w-0",
          primaryLeads ? "lg:order-1" : "lg:order-2",
          a === 8 && "lg:col-span-8",
          a === 7 && "lg:col-span-7",
          a === 5 && "lg:col-span-5",
          a === 4 && "lg:col-span-4",
          !secondaryFirstOnMobile ? "order-1" : "order-2 mt-12 lg:mt-0",
        )}
      >
        {primary}
      </div>

      <aside
        className={cn(
          "min-w-0",
          primaryLeads ? "lg:order-2" : "lg:order-1",
          b === 5 && "lg:col-span-5",
          b === 4 && "lg:col-span-4",
          b === 7 && "lg:col-span-7",
          b === 8 && "lg:col-span-8",
          !secondaryFirstOnMobile ? "order-2 mt-12 lg:mt-0" : "order-1",
          sticky &&
            "app-scroll lg:sticky lg:top-[calc(var(--topbar-h)+2rem)] lg:max-h-[calc(100dvh-var(--topbar-h)-4rem)] lg:overflow-y-auto",
        )}
      >
        {secondary}
      </aside>
    </div>
  );
}
