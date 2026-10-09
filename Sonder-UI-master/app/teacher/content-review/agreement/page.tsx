"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Container,
  PageMasthead,
  Section,
  Split,
  Callout,
} from "@/components/layout";
import { Label } from "@/components/type";
import { Mark } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { GENERATED_ITEM } from "@/fixtures/content/generated-item";
import { GENERATION_RUN, type GenerationRun } from "@/fixtures/content/generation-run";

const VERDICT_LABEL: Record<string, string> = {
  approve: "Approve",
  "approve-with-edit": "Approve with edit",
  reject: "Reject",
};

const BATCH_REVIEWERS = [
  {
    name: "Imran Shah",
    verdict: "approve" as const,
    note: "Ran every item by hand. The M4 distractor is correctly the un-rounded value in each case, so the arithmetic checks out.",
  },
  {
    name: "Ayesha Siddiqui",
    verdict: "approve" as const,
    note: "Agree. Good spread of rounding places (whole number, one dp, two dp). No changes needed.",
  },
];

export default function AgreementView() {
  return (
    <Suspense fallback={null}>
      <AgreementContent />
    </Suspense>
  );
}

function AgreementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchRunId = searchParams.get("batch");
  const isBatch = batchRunId === GENERATION_RUN.id;

  if (isBatch) {
    return <BatchAgreement run={GENERATION_RUN} />;
  }

  const item = GENERATED_ITEM;
  const [a, b] = item.reviewers;
  const agree = a.verdict === b.verdict;

  return (
    <Container>
      <PageMasthead
        label="Agreement"
        title="Two-reviewer agreement"
        lede="A generated item enters the bank only after two reviewers have seen it. Where they differ, you adjudicate."
      />
      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              <div className="grid gap-12 md:grid-cols-2">
                {item.reviewers.map((r) => (
                  <div key={r.name}>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-lg font-medium">{r.name}</p>
                      <Mark bucket={r.verdict === "approve" ? "confirmed" : "attention"}>
                        {VERDICT_LABEL[r.verdict]}
                      </Mark>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {r.note}
                    </p>
                  </div>
                ))}
              </div>

              <Callout
                className="mt-16"
                tone="attention"
                kicker="Disputed"
                title={'Option "6 mol"'}
                body="Reviewer A left it mapped to a misconception; Reviewer B wants it marked unmapped because halving the amount is not a modelled error."
              />

              <div className="mt-12 border-t-2 border-t-accent pt-8">
                <Label tone="accent">Adjudication</Label>
                <p className="mt-4 text-base leading-relaxed">{item.adjudication}</p>
              </div>

              <div className="mt-12 flex flex-wrap gap-8">
                <Button
                  onClick={() => {
                    toast.success("Added to the question bank", {
                      description:
                        "Provenance logged: generated 28 Aug, approved by two reviewers, adjudicated today.",
                    });
                    router.push("/teacher/content-review");
                  }}
                >
                  Confirm adjudication and add to bank
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/teacher/content-review")}
                >
                  Back
                </Button>
              </div>
            </div>
          }
          secondary={
            <div>
              <Label tone="muted">Batch identity</Label>
              <p className="mt-4 font-mono text-sm">{item.id}</p>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                {item.question}
              </p>
              <div className="mt-8">
                <Mark bucket={agree ? "confirmed" : "attention"}>
                  {agree
                    ? "Both reviewers agree."
                    : "Both approve the question. They disagree on one distractor's label."}
                </Mark>
              </div>
            </div>
          }
        />
      </Section>
    </Container>
  );
}

function BatchAgreement({ run }: { run: GenerationRun }) {
  const router = useRouter();
  const [a] = BATCH_REVIEWERS;
  const agree = BATCH_REVIEWERS.every((r) => r.verdict === a.verdict);

  return (
    <Container>
      <PageMasthead
        label="Agreement"
        title="Two-reviewer agreement"
        lede={`Batch ${run.id} · ${run.finalBatch.length} items · second reviewer`}
      />
      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div>
              <div className="grid gap-12 md:grid-cols-2">
                {BATCH_REVIEWERS.map((r) => (
                  <div key={r.name}>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-lg font-medium">{r.name}</p>
                      <Mark bucket="confirmed">{VERDICT_LABEL[r.verdict]}</Mark>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {r.note}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-12 flex flex-wrap gap-8">
                <Button
                  onClick={() => {
                    toast.success(
                      `${run.finalBatch.length} items added to the question bank`,
                      {
                        description: `Batch ${run.id}: generated ${run.startedAt}, approved by two reviewers.`,
                      },
                    );
                    router.push("/teacher/content-review");
                  }}
                >
                  Confirm and add {run.finalBatch.length} items to the bank
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push("/teacher/content-review")}
                >
                  Back
                </Button>
              </div>
            </div>
          }
          secondary={
            <div>
              <Label tone="muted">Batch identity</Label>
              <p className="mt-4 font-mono text-sm">{run.id}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                {run.finalBatch.length} items · {cap(run.trigger.subject)}
              </p>
              <div className="mt-8">
                <Mark bucket={agree ? "confirmed" : "attention"}>
                  Both reviewers agree on the batch.
                </Mark>
              </div>
              <ul className="mt-8 border-t border-border">
                {run.finalBatch.map((q, i) => (
                  <li key={q.id} className="flex gap-4 border-b border-border py-3 text-sm">
                    <span className="nums text-faint">{i + 1}</span>
                    <span className="truncate">{q.questionText}</span>
                  </li>
                ))}
              </ul>
            </div>
          }
        />
      </Section>
    </Container>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
