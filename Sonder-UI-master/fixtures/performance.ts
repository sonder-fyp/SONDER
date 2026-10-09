/**
 * Performance reporting (Feature 20): Sonder's accuracy, question efficiency and
 * error rate, each measured against a simpler method rather than reported alone.
 * All figures are illustrative fixture data for the PoC.
 */

export type PerfMetric = {
  label: string;
  value: string;
  baselineLabel: string;
  baselineValue: string;
  delta: string;
  direction: "up" | "down";
  goodWhen: "up" | "down";
};

export const PERF_METRICS: PerfMetric[] = [
  {
    label: "Questions to a diagnosis",
    value: "3.4",
    baselineLabel: "fixed six-item quiz",
    baselineValue: "6.0",
    delta: "-2.6",
    direction: "down",
    goodWhen: "down",
  },
  {
    label: "False-diagnosis rate",
    value: "4.1%",
    baselineLabel: "keyword matching on the wrong answer",
    baselineValue: "12.8%",
    delta: "-8.7 pts",
    direction: "down",
    goodWhen: "down",
  },
];

export const PERF_NOTES = {
  sampleSize: "412 completed sessions across Maths, Physics and Chemistry",
  window: "3 Aug – 3 Sep 2026",
  caveat:
    "Ground truth is the teacher's approved decision, so accuracy is measured against teacher judgement, not an external key.",
};
