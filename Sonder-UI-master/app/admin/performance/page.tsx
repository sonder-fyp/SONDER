import {
  Container,
  PageMasthead,
  Section,
  Split,
} from "@/components/layout";
import { MetricCard } from "@/components/shared";
import { Label } from "@/components/type";
import { PERF_METRICS, PERF_NOTES } from "@/fixtures/performance";

export default function PerformanceReport() {
  return (
    <Container>
      <PageMasthead
        label="Performance"
        title="Performance reporting"
        lede="Accuracy, question efficiency and error rate: each measured against a simpler method, not reported on its own."
      />

      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              <div className="grid gap-8 sm:grid-cols-2">
                {PERF_METRICS.map((m) => (
                  <MetricCard
                    key={m.label}
                    label={m.label}
                    value={m.value}
                    comparisonValue={m.delta}
                    comparisonLabel={`vs ${m.baselineLabel} (${m.baselineValue})`}
                    direction={m.direction}
                    goodWhen={m.goodWhen}
                  />
                ))}
              </div>
            </div>
          }
          secondary={
            <div>
              <Label tone="muted">Baseline</Label>
              <p className="mt-4 text-xl font-semibold leading-snug tracking-tight">
                Compared against simpler methods on the same sample
              </p>
              <p className="mt-6 text-sm text-muted-foreground">
                Sample: {PERF_NOTES.sampleSize}.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Window: {PERF_NOTES.window}.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{PERF_NOTES.caveat}</p>
            </div>
          }
        />
      </Section>
    </Container>
  );
}
