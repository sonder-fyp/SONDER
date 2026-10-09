import { Label, Heading } from "@/components/type";
import { cn } from "@/lib/utils";

/**
 * The one urgent thing on a page. A full-width 2px rule above it does the work
 * a coloured box used to do. One Callout per page, maximum: if everything is
 * urgent, nothing is.
 */
export function Callout({
  kicker,
  title,
  body,
  action,
  tone = "accent",
  className,
}: {
  kicker: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "accent" | "attention" | "neutral";
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-t-2 pt-8",
        tone === "accent" && "border-t-accent",
        tone === "attention" && "border-t-attention",
        tone === "neutral" && "border-t-foreground",
        className,
      )}
    >
      <Label tone={tone === "neutral" ? "muted" : tone}>{kicker}</Label>
      <Heading scale="item" className="mt-4">
        {title}
      </Heading>
      {body ? (
        <div className="mt-4 max-w-2xl text-base leading-normal text-muted-foreground">
          {body}
        </div>
      ) : null}
      {action ? (
        <div className="mt-8 flex flex-wrap items-center gap-8">{action}</div>
      ) : null}
    </section>
  );
}
