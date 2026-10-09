import { cn } from "@/lib/utils";

export type Hypothesis = { id: string; label: string; probability: number };

/**
 * Competing hypotheses as hairline bars. Three states must be distinguishable
 * without colour:
 *  - gathering: leader in foreground, others muted
 *  - diagnosis: leader crosses the threshold, turns accent, gains a bold %
 *  - tie:       top two get a dashed overlay AND a "TIED" word. Never colour alone.
 */
export function PosteriorBarSet({
  hypotheses,
  diagnosisThreshold = 0.75,
  tieEpsilon = 0.03,
  caption,
  className,
}: {
  hypotheses: Hypothesis[];
  diagnosisThreshold?: number;
  tieEpsilon?: number;
  caption?: string;
  className?: string;
}) {
  const sorted = [...hypotheses].sort((a, b) => b.probability - a.probability);
  const leader = sorted[0];
  const runnerUp = sorted[1];

  const isTie =
    !!runnerUp &&
    leader.probability >= 0.25 &&
    leader.probability - runnerUp.probability <= tieEpsilon;
  const isDiagnosis = !isTie && leader.probability >= diagnosisThreshold;
  const tied = isTie ? new Set([leader.id, runnerUp.id]) : new Set<string>();

  const resolvedCaption =
    caption ??
    (isTie
      ? `${leader.label} and ${runnerUp.label} are level. The engine needs a question that separates them before it can resolve.`
      : isDiagnosis
        ? `${leader.label} is above the ${Math.round(diagnosisThreshold * 100)}% confidence threshold.`
        : "Still gathering evidence.");

  return (
    <div className={cn("border-t border-border", className)}>
      {sorted.map((h) => {
        const pct = Math.round(h.probability * 100);
        const isTied = tied.has(h.id);
        const isLeader = h.id === leader.id;
        const fill = isTied
          ? "bg-attention"
          : isLeader && isDiagnosis
            ? "bg-accent"
            : isLeader
              ? "bg-foreground"
              : "bg-muted-foreground";

        return (
          <div key={h.id} className="border-b border-border py-5">
            <div className="flex items-baseline justify-between gap-4">
              <span
                className={cn(
                  "min-w-0 truncate text-sm",
                  isLeader ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {h.label}
                {isTied ? (
                  <span className="label ml-3 text-attention">Tied</span>
                ) : null}
              </span>
              <span
                className={cn(
                  "nums shrink-0 font-mono text-lg leading-none",
                  isTied
                    ? "text-attention"
                    : isLeader && isDiagnosis
                      ? "text-accent"
                      : isLeader
                        ? "text-foreground"
                        : "text-muted-foreground",
                )}
              >
                {pct}%
              </span>
            </div>

            <div
              className="relative mt-3 h-1 w-full bg-border"
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={h.label}
            >
              {/* the diagnosis threshold, as a tick that overshoots the track */}
              <span
                aria-hidden
                className="absolute -top-1 h-3 w-px bg-border-strong"
                style={{ left: `${diagnosisThreshold * 100}%` }}
              />
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-500 ease-[var(--ease)] motion-reduce:transition-none",
                  fill,
                )}
                style={{ width: `${Math.max(pct, 1)}%` }}
              >
                {isTied ? (
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent 0 3px, var(--hatch) 3px 6px)",
                    }}
                  />
                ) : null}
              </span>
            </div>
          </div>
        );
      })}

      <p
        className={cn(
          "pt-5 text-sm leading-relaxed",
          isTie
            ? "text-attention"
            : isDiagnosis
              ? "text-accent"
              : "text-muted-foreground",
        )}
      >
        {resolvedCaption}
      </p>
    </div>
  );
}
