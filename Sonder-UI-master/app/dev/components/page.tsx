"use client";

/** Dev-only gallery of the shared component library. Not a product screen. */

import { useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/app/BrandMark";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { FilterStrip } from "@/components/app/FilterStrip";
import { DataTable, type Column } from "@/components/app/DataTable";
import { StepTimeline } from "@/components/app/StepTimeline";
import { EmptyState } from "@/components/app/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Label,
  Heading,
  Quote,
  AccentBar,
  SectionRule,
  Stat,
  StatRow,
  LayeredNumber,
} from "@/components/type";
import {
  Container,
  PageMasthead,
  Section as LayoutSection,
  Panel,
  Callout,
  ListRow,
  LinkRow,
  GroupHeading,
  MetaList,
} from "@/components/layout";
import {
  PosteriorBarSet,
  EvidenceStep,
  MisconceptionCard,
  StatusMark,
  Mark,
  OutcomeBanner,
  MetricCard,
  VerificationTag,
  type Hypothesis,
} from "@/components/shared";

const POSTERIOR_STATES: { name: string; hyps: Hypothesis[] }[] = [
  {
    name: "Gathering",
    hyps: [
      { id: "M1", label: "Rounds to nearest 10", probability: 0.31 },
      { id: "M2", label: "Truncates instead of rounding", probability: 0.27 },
      { id: "M4", label: "Rounds the wrong digit", probability: 0.22 },
      { id: "NONE", label: "No misconception", probability: 0.2 },
    ],
  },
  {
    name: "Tie",
    hyps: [
      { id: "M4", label: "Rounds the wrong digit", probability: 0.44 },
      { id: "NONE", label: "No misconception", probability: 0.43 },
      { id: "M2", label: "Truncates instead of rounding", probability: 0.09 },
      { id: "M1", label: "Rounds to nearest 10", probability: 0.04 },
    ],
  },
  {
    name: "Resolved",
    hyps: [
      { id: "M4", label: "Rounds the wrong digit", probability: 0.82 },
      { id: "NONE", label: "No misconception", probability: 0.1 },
      { id: "M2", label: "Truncates instead of rounding", probability: 0.05 },
      { id: "M1", label: "Rounds to nearest 10", probability: 0.03 },
    ],
  },
];

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-16 md:py-20">
      <Label tone="muted">{title}</Label>
      <div className="mt-8">{children}</div>
    </section>
  );
}

type Row = { id: string; name: string; topic: string };

const TABLE_ROWS: Row[] = [
  { id: "1", name: "Zara Qureshi", topic: "Rounding" },
  { id: "2", name: "Hina Raza", topic: "Moles" },
];

const COLUMNS: Column<Row>[] = [
  { key: "name", header: "Student", cell: (r) => r.name },
  { key: "topic", header: "Topic", cell: (r) => r.topic },
];

export default function ComponentGallery() {
  const [stateIdx, setStateIdx] = useState(0);
  const [filter, setFilter] = useState<"all" | "maths" | "physics">("all");
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState("1");
  const state = POSTERIOR_STATES[stateIdx];

  return (
    <>
      <div className="fixed right-4 top-4 z-50 border border-border-strong bg-background">
        <ThemeToggle />
      </div>
    <Container>
      <PageMasthead
        scale="hero"
        label="Dev"
        title="Component gallery"
        lede="Specimens of the typographic system. This route carries no product chrome."
        meta={
          <div>
            <BrandMark />
            <p className="mt-4 text-sm text-muted-foreground">Dark only. Sharp corners. One accent.</p>
          </div>
        }
      />

      <Block title="Type: Label, Heading, Quote, AccentBar, SectionRule">
        <Label tone="accent">Accent label</Label>
        <Heading scale="section" className="mt-6">
          A heading at section scale
        </Heading>
        <AccentBar className="mt-8" />
        <SectionRule className="mt-10" />
        <Quote className="mt-10" cite="The only Playfair call site in this gallery">
          Type is the design. Colour is a pointer.
        </Quote>
      </Block>

      <Block title="Type: Stat and StatRow">
        <StatRow
          items={[
            { label: "Awaiting review", value: 3, tone: "attention" },
            { label: "Escalated", value: 1, tone: "attention" },
            { label: "Resolved", value: 12, tone: "accent" },
          ]}
        />
        <Stat value="404" label="Layered number companion" className="relative mt-16" />
        <div className="relative mt-8 h-24">
          <LayeredNumber value="01" />
        </div>
      </Block>

      <Block title="Buttons">
        <div className="flex flex-wrap items-center gap-8">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            As a link
          </Link>
        </div>
      </Block>

      <Block title="Form controls">
        <div className="grid max-w-xl gap-6">
          <Input placeholder="Search name, description or code" />
          <Textarea placeholder="A short note for the record" />
        </div>
      </Block>

      <Block title="Layout: Callout, Panel, Split">
        <Callout
          tone="attention"
          kicker="Due now"
          title="Follow-up check due"
          body="Rounding to decimal places. One quick question."
          action={<Button>Take the check</Button>}
        />
        <div className="mt-16 grid gap-8 md:grid-cols-2">
          <Panel>
            <Label tone="muted">Default panel</Label>
            <p className="mt-4 text-base">Hairline border, no radius, no fill.</p>
          </Panel>
          <Panel highlighted>
            <Label tone="accent">Highlighted</Label>
            <p className="mt-4 text-base">2px accent border.</p>
          </Panel>
        </div>
      </Block>

      <Block title="Rows">
        <GroupHeading count={2}>Last session</GroupHeading>
        <ListRow
          leading={<StatusMark status="diagnosed" />}
          title="Rounding to decimal places"
          meta="Study note ready to read"
          selected={selected === "1"}
          onSelect={() => setSelected("1")}
        />
        <ListRow
          leading={<StatusMark status="escalated" />}
          title="Moles and stoichiometry"
          meta="Needs a human"
          selected={selected === "2"}
          onSelect={() => setSelected("2")}
        />
        <LinkRow
          href="/student/start"
          title="New diagnostic"
          description="Pick a subject and a topic."
        />
        <MetaList
          className="mt-10"
          items={[
            { label: "Subject", value: "Mathematics" },
            { label: "Code", value: "M4" },
          ]}
        />
      </Block>

      <Block title="Status marks">
        <div className="flex flex-wrap gap-8">
          <StatusMark status="diagnosed" />
          <StatusMark status="escalated" />
          <StatusMark status="awaiting-review" />
          <StatusMark status="catalogued-only" />
          <Mark bucket="inert">Rejected</Mark>
        </div>
        <div className="mt-8 flex flex-wrap gap-8">
          <VerificationTag kind="computed" />
          <VerificationTag kind="ai-proposed" />
        </div>
      </Block>

      <Block title="OutcomeBanner">
        <OutcomeBanner
          type="diagnosed"
          message="Zara is rounding from the wrong digit. Next: the study note on place value in rounding."
        />
        <OutcomeBanner
          className="mt-12"
          type="unsure"
          message="The answers so far do not point to one clear misconception. Your teacher will look at this with you."
        />
      </Block>

      <Block title="MetricCard">
        <div className="grid gap-8 sm:grid-cols-2">
          <MetricCard
            label="Days to resolve"
            value="2"
            comparisonValue="6"
            comparisonLabel="class median"
            direction="down"
            goodWhen="down"
          />
          <MetricCard
            label="Accuracy"
            value="81.4%"
            comparisonValue="+13.1"
            comparisonLabel="vs majority vote"
            direction="up"
            goodWhen="up"
          />
        </div>
      </Block>

      <Block title="MisconceptionCard">
        <MisconceptionCard
          code="M4"
          name="Rounds from the wrong digit"
          description="Looks at the digit two places past the rounding position instead of the one immediately to its right."
          status="validated"
        />
        <MisconceptionCard
          code="M2"
          name="Truncates instead of rounding"
          description="Drops the trailing digits and keeps what remains."
          status="pending"
        />
      </Block>

      <Block title={`PosteriorBarSet: ${state.name}`}>
        <PosteriorBarSet hypotheses={state.hyps} />
        <div className="mt-8 flex flex-wrap gap-8">
          {POSTERIOR_STATES.map((s, i) => (
            <Button
              key={s.name}
              variant={i === stateIdx ? "primary" : "outline"}
              onClick={() => setStateIdx(i)}
            >
              {s.name}
            </Button>
          ))}
        </div>
      </Block>

      <Block title="EvidenceStep">
        <EvidenceStep
          index={1}
          questionText="Round 27.48 to the nearest whole number."
          answerGiven="28"
          reasoning="The answer matches M4 more than truncation."
          isCurrent
        />
        <EvidenceStep
          index={2}
          questionText="Round 3.141 to two decimal places."
          answerGiven="3.14"
          reasoning="Consistent with checking the wrong digit."
        />
      </Block>

      <Block title="FilterStrip and StepTimeline">
        <FilterStrip
          label="Subject"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: 12 },
            { value: "maths", label: "Mathematics", count: 5 },
            { value: "physics", label: "Physics", count: 4 },
          ]}
        />
        <div className="mt-10">
          <StepTimeline total={5} current={step} onStepChange={setStep} />
        </div>
      </Block>

      <Block title="DataTable">
        <DataTable
          caption="Specimen roster"
          rows={TABLE_ROWS}
          getRowKey={(r) => r.id}
          columns={COLUMNS}
        />
      </Block>

      <Block title="EmptyState">
        <EmptyState
          title="Nothing matches those filters."
          body="Try a broader term, or clear the subject filter."
        />
      </Block>

      <Block title="rule-sweep">
        <div className="w-40">
          <div className="rule-sweep" aria-hidden />
        </div>
      </Block>

      <LayoutSection size="tight" bordered>
        <p className="text-sm text-muted-foreground">End of gallery.</p>
      </LayoutSection>
    </Container>
    </>
  );
}
