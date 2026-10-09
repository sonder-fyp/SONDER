import { Label, Heading, AccentBar, SectionRule } from "@/components/type";
import { cn } from "@/lib/utils";

/**
 * The poster opening. Asymmetric 8/4 by construction: the title block never
 * spans the full grid, which is what keeps every page off a centred axis.
 *
 * Compact density is for ChatFrame only: one h1 at item scale, no AccentBar,
 * no poster rule. Other routes keep the default poster opening.
 *
 * Renders the page's ONE <h1>. No other component may render one.
 */
export function PageMasthead({
  label,
  title,
  lede,
  meta,
  actions,
  tabs,
  scale = "page",
  density = "poster",
  className,
}: {
  /** Mono, uppercase, accent. Two to four words. Always present. */
  label: string;
  title: React.ReactNode;
  /** One or two sentences. Capped at max-w-2xl for measure. */
  lede?: string;
  /** Right-hand column at lg: a MetaList, a StatusMark, a date. Optional. */
  meta?: React.ReactNode;
  /** Buttons. Always separated by gap-8; see the button underline note. */
  actions?: React.ReactNode;
  /** A RouteTabs strip. Renders below the rule. */
  tabs?: React.ReactNode;
  scale?: "hero" | "page";
  density?: "poster" | "compact";
  className?: string;
}) {
  if (density === "compact") {
    return (
      <header className={cn("relative py-6", className)}>
        <Label tone="accent">{label}</Label>
        <Heading level={1} scale="item" className="mt-3">
          {title}
        </Heading>
        {lede ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {lede}
          </p>
        ) : null}
        {actions ? (
          <div className="mt-6 flex flex-wrap items-center gap-8">{actions}</div>
        ) : null}
        {tabs ? <div className="mt-6">{tabs}</div> : null}
      </header>
    );
  }

  return (
    <header className={cn("relative pt-12 md:pt-16", className)}>
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-8">
          <Label tone="accent">{label}</Label>
          <Heading level={1} scale={scale} className="mt-6">
            {title}
          </Heading>
          <AccentBar className="mt-8" />
          {lede ? (
            <p className="mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {lede}
            </p>
          ) : null}
        </div>

        {meta ? (
          <div className="mt-10 lg:col-span-4 lg:mt-0 lg:pt-2">{meta}</div>
        ) : null}
      </div>

      {actions ? (
        <div className="mt-10 flex flex-wrap items-center gap-8">{actions}</div>
      ) : null}

      <div className="mt-10 md:mt-12">
        <SectionRule />
      </div>

      {tabs ? <div className="mt-8">{tabs}</div> : null}
    </header>
  );
}
