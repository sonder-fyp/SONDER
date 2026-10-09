import { cn } from "@/lib/utils";
import { Label } from "@/components/type";

/**
 * One row of the answer trace: the question asked, the answer given, and the
 * engine's one-line reason for choosing it. The current step is marked by a 2px
 * accent rule on the left plus a muted ground, never by colour alone.
 */
export function EvidenceStep({
  index,
  questionText,
  answerGiven,
  reasoning,
  isCurrent,
  className,
}: {
  index: number;
  questionText: string;
  answerGiven: string;
  reasoning: string;
  isCurrent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative border-b border-border py-8 pl-8",
        isCurrent && "bg-muted",
        className,
      )}
    >
      {isCurrent ? (
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-accent" />
      ) : null}

      <span
        aria-hidden
        className={cn(
          "nums absolute left-0 top-8 font-mono text-sm",
          isCurrent ? "text-accent" : "text-faint",
          isCurrent && "pl-3",
        )}
      >
        {String(index).padStart(2, "0")}
      </span>

      <p className="text-lg font-medium leading-snug">{questionText}</p>

      <p className="mt-4 text-base">
        <span className="text-muted-foreground">Answered </span>
        <span className="font-medium text-foreground">{answerGiven}</span>
      </p>

      <Label tone="muted" className="mt-6">
        Why this question
      </Label>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {reasoning}
      </p>
    </div>
  );
}
