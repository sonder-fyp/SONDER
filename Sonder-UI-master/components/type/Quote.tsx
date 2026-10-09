import { cn } from "@/lib/utils";

/**
 * Playfair Display. One of only four permitted call sites in the build; see
 * the plan, part 2.4. If you are reaching for this and the content is not a
 * pull quote or an editorial lede, use Heading instead.
 */
export function Quote({
  children,
  cite,
  className,
}: {
  children: React.ReactNode;
  cite?: string;
  className?: string;
}) {
  return (
    <figure className={cn("max-w-3xl", className)}>
      <blockquote className="font-quote text-2xl leading-relaxed tracking-normal text-foreground sm:text-3xl">
        {children}
      </blockquote>
      {cite ? (
        <figcaption className="label mt-6 text-muted-foreground">{cite}</figcaption>
      ) : null}
    </figure>
  );
}
