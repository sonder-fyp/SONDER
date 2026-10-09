import { cn } from "@/lib/utils";

export function ChatFrame({
  header,
  chips,
  composer,
  children,
  className,
}: {
  header?: React.ReactNode;
  /** Suggestion chips wrap inside the padded column so a long prompt is never sliced. */
  chips?: React.ReactNode;
  composer: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="chat-frame"
      className={cn("min-w-0 w-full overflow-x-clip", className)}
      style={{ height: "calc(100dvh - var(--topbar-h))" }}
    >
      <div
        data-slot="chat-column"
        className="mx-auto grid h-full min-w-0 w-full max-w-[1200px] px-6 md:px-12 lg:px-16"
        style={{ gridTemplateRows: "auto minmax(0,1fr) auto" }}
      >
        {header ? (
          <div className="min-h-0 shrink-0 border-b border-border">{header}</div>
        ) : (
          <div />
        )}

        <div
          data-slot="chat-transcript"
          className="app-scroll min-h-0 min-w-0 overflow-y-auto py-6"
        >
          {children}
        </div>

        <div
          data-slot="chat-footer"
          className="min-w-0 shrink-0 border-t border-border bg-background pb-6 pt-6"
        >
          {chips ? (
            <div
              data-slot="chat-chips"
              className="mb-4 flex min-w-0 flex-wrap gap-4"
            >
              {chips}
            </div>
          ) : null}
          {composer}
        </div>
      </div>
    </div>
  );
}
