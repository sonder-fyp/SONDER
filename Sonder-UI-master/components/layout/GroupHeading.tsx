import { cn } from "@/lib/utils";
import { SectionRule } from "@/components/type";

export function GroupHeading({
  children,
  count,
  action,
  className,
}: {
  children: React.ReactNode;
  count?: number | string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <div className="flex items-baseline justify-between gap-6 pb-4">
        <h2 className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tracking-tight">{children}</span>
          {count !== undefined ? (
            <span className="label nums text-muted-foreground">{count}</span>
          ) : null}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <SectionRule />
    </div>
  );
}
