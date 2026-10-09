import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { PageMasthead, Container, Split } from "@/components/layout";
import { EmptyState } from "@/components/app/EmptyState";
import { Label } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { STUDENT_PACE } from "@/fixtures/insights/student-pace";
import { cn } from "@/lib/utils";

export default function StudentInsights() {
  const { rows, suggestion } = STUDENT_PACE;

  if (rows.length === 0) {
    return (
      <Container>
        <PageMasthead
          label="My insights"
          title="How quickly things get fixed."
          lede="This is not a grade. It is how long your resolved misconceptions took, next to the class median for the same subject."
        />
        <EmptyState
          title="No resolved cases yet."
          body="Once a misconception has been diagnosed and checked, its pace shows up here."
        />
      </Container>
    );
  }

  return (
    <Container>
      <PageMasthead
        label="My insights"
        title="How quickly things get fixed."
        lede="This is not a grade. It is how long your resolved misconceptions took, next to the class median for the same subject."
      />

      <Split
        ratio="8/4"
        sticky
        primary={
          <div>
            {rows.map((row) => {
              const faster = row.daysToResolve < row.classMedianDays;
              const slower = row.daysToResolve > row.classMedianDays;
              const Icon = faster ? ArrowDownRight : slower ? ArrowUpRight : Minus;
              const tone = faster
                ? "text-accent"
                : slower
                  ? "text-attention"
                  : "text-muted-foreground";
              return (
                <div key={row.label} className="border-b border-border py-12 first:pt-0">
                  <Label tone="muted">{row.subject}</Label>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight">{row.label}</h2>
                  <p className="nums mt-8 font-mono text-5xl leading-none tracking-tight">
                    {row.daysToResolve}
                    <span className="ml-3 text-base font-normal text-muted-foreground">
                      {row.daysToResolve === 1 ? "day" : "days"}
                    </span>
                  </p>
                  <p className="mt-6 flex items-baseline gap-2 text-sm">
                    <Icon className={cn("size-4 shrink-0 self-center", tone)} strokeWidth={1.5} aria-hidden />
                    <span className={cn("nums font-medium", tone)}>
                      Class median {row.classMedianDays} days
                    </span>
                  </p>
                  <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                    {row.evidence}
                  </p>
                </div>
              );
            })}
          </div>
        }
        secondary={
          <div className="border-t-2 border-t-accent pt-8">
            <Label tone="accent">Pattern-based suggestion</Label>
            <p className="mt-6 text-base leading-relaxed">{suggestion.text}</p>
            <ul className="mt-8 border-t border-border">
              {suggestion.evidence.map((e) => (
                <li key={e} className="border-b border-border py-3 text-sm text-muted-foreground">
                  {e}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">{suggestion.sharedWith}</p>
            <Link
              href="/student/consultant"
              className={buttonVariants({ variant: "outline", className: "mt-8" })}
            >
              Ask the consultant about this
            </Link>
          </div>
        }
      />
    </Container>
  );
}
