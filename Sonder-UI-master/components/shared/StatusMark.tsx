import { Check, AlertTriangle, Clock, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Kept for fixtures/students.ts. Do not rename or narrow. */
export type SessionStatus =
  | "diagnosed"
  | "escalated"
  | "awaiting-review"
  | "catalogued-only";

/** The only four visual states in the build. See the plan, part 2.3. */
export type MarkBucket = "confirmed" | "attention" | "pending" | "inert";

const BUCKET: Record<MarkBucket, { icon: LucideIcon; className: string }> = {
  confirmed: { icon: Check, className: "text-accent" },
  attention: { icon: AlertTriangle, className: "text-attention" },
  pending: { icon: Clock, className: "text-foreground" },
  inert: { icon: Minus, className: "text-muted-foreground" },
};

/**
 * Glyph plus word, both in the bucket colour, in wide-tracked mono.
 * There is no pill, no fill and no border: colour is reinforcement, and the
 * glyph and the word carry the meaning on their own.
 */
export function Mark({
  bucket,
  children,
  glyph = true,
  className,
}: {
  bucket: MarkBucket;
  children: React.ReactNode;
  /** Set false only where a glyph is already shown alongside. */
  glyph?: boolean;
  className?: string;
}) {
  const { icon: Icon, className: tone } = BUCKET[bucket];
  return (
    <span className={cn("label inline-flex items-center gap-2", tone, className)}>
      {glyph ? <Icon className="size-3.5 shrink-0" strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </span>
  );
}

const SESSION: Record<SessionStatus, { bucket: MarkBucket; label: string }> = {
  diagnosed: { bucket: "confirmed", label: "Diagnosed" },
  escalated: { bucket: "attention", label: "Escalated" },
  "awaiting-review": { bucket: "pending", label: "Awaiting review" },
  "catalogued-only": { bucket: "inert", label: "Catalogued only" },
};

export function StatusMark({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  const { bucket, label } = SESSION[status];
  return (
    <Mark bucket={bucket} className={className}>
      {label}
    </Mark>
  );
}

/** The bucket alone, for a dense row that has no space for the word.
 *  Always paired with an sr-only label at the call site. */
export function statusBucket(status: SessionStatus): MarkBucket {
  return SESSION[status].bucket;
}

export { BUCKET as MARK_BUCKET };
