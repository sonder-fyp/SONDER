import { cn } from "@/lib/utils";

/**
 * The type scale, applied by name instead of by remembering four classes.
 * Tracking is a function of size and is never chosen independently:
 * display sizes get -0.06em, large headings -0.04em.
 */
const SCALE = {
  /** The landing statement only. 8:1 against body. */
  statement:
    "text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-none",
  /** Role home pages and the landing sections. 6:1 against body. */
  hero: "text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tighter leading-tight",
  /** Every interior route's h1. 4.5:1 against body. */
  page: "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-tight",
  /** Major block inside a page. */
  section: "text-3xl sm:text-4xl font-semibold tracking-tight leading-tight",
  /** A named thing inside a block: a student, a misconception, a question. */
  item: "text-xl sm:text-2xl font-semibold tracking-tight leading-snug",
  /** The smallest real heading. */
  minor: "text-lg font-semibold tracking-normal leading-snug",
} as const;

export function Heading({
  level = 2,
  scale = "section",
  children,
  className,
}: {
  level?: 1 | 2 | 3 | 4;
  scale?: keyof typeof SCALE;
  children: React.ReactNode;
  className?: string;
}) {
  const Tag = `h${level}` as const;
  return <Tag className={cn(SCALE[scale], className)}>{children}</Tag>;
}

export { SCALE as HEADING_SCALE };
