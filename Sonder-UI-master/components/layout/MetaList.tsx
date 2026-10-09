import { cn } from "@/lib/utils";

export type MetaItem = { label: string; value: React.ReactNode };

export function MetaList({
  items,
  className,
}: {
  items: MetaItem[];
  className?: string;
}) {
  return (
    <dl className={cn("border-t border-border", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-6 border-b border-border py-4"
        >
          <dt className="label shrink-0 text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-right text-sm leading-snug">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
