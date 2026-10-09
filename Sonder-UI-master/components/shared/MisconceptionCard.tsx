import { cn } from "@/lib/utils";
import { Mark } from "./StatusMark";

/** Kept for fixtures/catalogue.ts. Do not rename or narrow. */
export type MisconceptionStatus = "validated" | "pending" | "catalogued-only";

const STATUS: Record<
  MisconceptionStatus,
  { bucket: "confirmed" | "pending" | "inert"; label: string }
> = {
  validated: { bucket: "confirmed", label: "Validated" },
  pending: { bucket: "pending", label: "Pending" },
  "catalogued-only": { bucket: "inert", label: "Catalogued only" },
};

export function MisconceptionCard({
  name,
  description,
  code,
  status,
  selected,
  className,
  children,
}: {
  name: string;
  description: string;
  code?: string;
  status?: MisconceptionStatus;
  selected?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const s = status ? STATUS[status] : null;
  return (
    <div
      className={cn(
        "relative border-b border-border py-6 pl-6 transition-colors duration-150",
        selected && "bg-muted",
        className,
      )}
    >
      {selected ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-4">
          {code ? (
            <span className="label nums shrink-0 text-faint">{code}</span>
          ) : null}
          <h3 className="min-w-0 text-lg font-medium leading-snug">{name}</h3>
        </div>
        {s ? <Mark bucket={s.bucket}>{s.label}</Mark> : null}
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {children ? <div className="mt-6 flex flex-wrap gap-8">{children}</div> : null}
    </div>
  );
}
