import { cn } from "@/lib/utils";

/**
 * 1200px measure with the design system's responsive gutters:
 * 24px mobile, 48px tablet, 64px desktop.
 *
 * `width="wide"` (1440px) is for the two genuinely wide screens: the teacher
 * dashboard roster and the provenance log. Nothing else may use it.
 * `width="narrow"` (720px) is for reading and task surfaces.
 */
export function Container({
  width = "default",
  children,
  className,
}: {
  width?: "narrow" | "default" | "wide";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 md:px-12 lg:px-16",
        width === "narrow" && "max-w-[720px]",
        width === "default" && "max-w-[1200px]",
        width === "wide" && "max-w-[1440px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
