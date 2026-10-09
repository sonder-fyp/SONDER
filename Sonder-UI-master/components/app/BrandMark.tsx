import { cn } from "@/lib/utils";

/** Transparent crop of the authoring file `SONDER.png`. */
const MARK_SRC = "/brand/sonder-mark.png";
const MARK_W = 521;
const MARK_H = 1149;

/**
 * The Sonder mark: the geometric S plus the tracked word. The glyph is the
 * authored logo, not a stroke from the landing wordmark.
 */
export function BrandMark({
  size = 36,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  const height = size;
  const width = Math.max(1, Math.round((size * MARK_W) / MARK_H));

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <img
        src={MARK_SRC}
        alt={withWordmark ? "" : "Sonder"}
        width={width}
        height={height}
        aria-hidden={withWordmark || undefined}
        className="shrink-0"
      />
      {withWordmark ? (
        <span className="font-mono text-[1.125rem] font-medium uppercase leading-none tracking-[0.34em]">
          Sonder
        </span>
      ) : null}
    </span>
  );
}
