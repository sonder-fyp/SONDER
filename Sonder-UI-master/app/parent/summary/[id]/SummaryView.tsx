"use client";

import Link from "next/link";
import type { ParentSummary } from "@/fixtures/parent";
import {
  Container,
  PageMasthead,
  Section,
  Split,
  MetaList,
} from "@/components/layout";
import { Mark } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { useTeacherReviews } from "@/lib/teacher-review";

export function SummaryView({ summary: s }: { summary: ParentSummary }) {
  const { decisions } = useTeacherReviews();

  const approved =
    s.approvedByDefault ||
    (s.gatedOnScenario &&
      ["approved", "corrected"].includes(decisions[s.gatedOnScenario] ?? ""));

  if (!approved) {
    return (
      <Container>
        <PageMasthead
          label="Summary"
          title={`${s.subject} · ${s.topicName}`}
          lede={s.date}
        />
        <Section size="tight">
          <Mark bucket="pending">Not approved yet</Mark>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
            Zara&apos;s teacher hasn&apos;t finished reviewing this. Parents only see a
            summary once it has been checked and approved.
          </p>
          <Link
            href="/parent"
            className={buttonVariants({ variant: "outline", className: "mt-10" })}
          >
            Back
          </Link>
        </Section>
      </Container>
    );
  }

  return (
    <Container>
      <PageMasthead
        label="Teacher-approved summary"
        title={`${s.subject} · ${s.topicName}`}
        lede={s.date}
      />
      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <div className="prose-editorial">
              <h2>What we found</h2>
              <p>{s.whatWeFound}</p>
              <h2>What to work on</h2>
              <p>{s.whatToWorkOn}</p>
              <h2>How it&apos;s going</h2>
              <p>{s.howItsGoing}</p>
            </div>
          }
          secondary={
            <div>
              <Mark bucket="confirmed">
                {s.approvedBy
                  ? `Approved by ${s.approvedBy}${s.approvedOn ? ` on ${s.approvedOn}` : ""}`
                  : "Approved by Zara's teacher"}
              </Mark>
              <MetaList
                className="mt-10"
                items={[
                  { label: "Subject", value: s.subject },
                  { label: "Topic", value: s.topicName },
                  { label: "Date", value: s.date },
                ]}
              />
              <Link
                href="/parent"
                className={buttonVariants({ variant: "outline", className: "mt-10" })}
              >
                Back to all summaries
              </Link>
            </div>
          }
        />
      </Section>
    </Container>
  );
}
