import { Label, Heading } from "@/components/type";
import { cn } from "@/lib/utils";

/**
 * An empty state is a poster too. Left aligned, no icon, no illustration, no
 * box: a label, a headline, one sentence, at most one action.
 */
export function EmptyState({
  label = "Nothing here",
  title,
  body,
  action,
  className,
}: {
  label?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-t border-border py-20 md:py-28", className)}>
      <Label tone="muted">{label}</Label>
      <Heading scale="section" className="mt-6 max-w-2xl">
        {title}
      </Heading>
      {body ? (
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-10">{action}</div> : null}
    </div>
  );
}
