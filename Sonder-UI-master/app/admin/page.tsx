import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Container,
  PageMasthead,
  Section,
  Callout,
  LinkRow,
  GroupHeading,
} from "@/components/layout";
import { StatRow } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { CATALOGUE } from "@/fixtures/catalogue";
import { COVERAGE_GAPS } from "@/fixtures/coverage";
import { PROVENANCE_LOG } from "@/fixtures/provenance";
import { PERF_METRICS } from "@/fixtures/performance";

export default function AdminHome() {
  const openGaps = COVERAGE_GAPS.filter((g) => g.status !== "closed").length;
  const inReview = PROVENANCE_LOG.filter((p) => p.status === "in-review").length;

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Admin"
        title="Content and curriculum"
        lede="The catalogue of known misconceptions, the gaps between them, and how the engine performs against simpler methods."
      />

      <Section size="compact">
        <StatRow
          items={[
            {
              label: "Catalogue",
              value: CATALOGUE.length,
              hint: "validated + pending",
              href: "/admin/catalogue",
            },
            {
              label: "Open gaps",
              value: openGaps,
              hint: `${inReview} item in review`,
              href: "/admin/coverage",
              tone: openGaps ? "attention" : "accent",
            },
            {
              label: PERF_METRICS[0].label,
              value: PERF_METRICS[0].value,
              hint: `vs ${PERF_METRICS[0].baselineValue} baseline`,
              href: "/admin/performance",
              tone: "accent",
            },
            {
              label: "Provenance",
              value: PROVENANCE_LOG.length,
              hint: "generated items logged",
              href: "/admin/provenance",
            },
          ]}
        />
      </Section>

      {openGaps > 0 ? (
        <Section size="compact" bordered>
          <Callout
            tone="attention"
            kicker="Coverage"
            title={`${openGaps} coverage gap${openGaps === 1 ? "" : "s"} need attention`}
            body="Misconception pairs no current question separates."
            action={
              <Link href="/admin/coverage" className={buttonVariants()}>
                Open coverage
                <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
              </Link>
            }
          />
        </Section>
      ) : null}

      <Section size="compact" bordered>
        <GroupHeading>Areas</GroupHeading>
        <LinkRow
          href="/admin/catalogue"
          title="Catalogue"
          description="Every validated misconception, per subject."
        />
        <LinkRow
          href="/admin/coverage"
          title="Coverage"
          description="Pairs no current question can tell apart."
        />
        <LinkRow
          href="/admin/performance"
          title="Performance"
          description="Accuracy and efficiency versus baselines."
        />
        <LinkRow
          href="/admin/provenance"
          title="Provenance"
          description="Who generated what, and who validated it."
        />
      </Section>
    </Container>
  );
}
