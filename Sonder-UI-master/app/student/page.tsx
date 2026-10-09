import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ROLES } from "@/lib/roles";
import { buttonVariants } from "@/components/ui/button";
import { Container, PageMasthead, Section, Callout, ListRow, LinkRow, GroupHeading } from "@/components/layout";
import { StatusMark } from "@/components/shared";

export default function StudentHome() {
  const first = ROLES.student.person.split(" ")[0];

  return (
    <Container>
      <PageMasthead
        scale="page"
        label="Student"
        title={`Welcome back, ${first}`}
        lede="Start a diagnostic when a topic feels shaky. Your teacher reviews everything before it goes anywhere."
        actions={
          <Link href="/student/start" className={buttonVariants({ size: "lg" })}>
            Start a diagnostic
            <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Link>
        }
      />

      <Section size="tight">
        <Callout
          tone="attention"
          kicker="Due now"
          title="Follow-up check due"
          body="Rounding to decimal places. One quick question."
          action={
            <Link href="/student/verify/B" className={buttonVariants()}>
              Take the check
              <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
            </Link>
          }
        />
      </Section>

      <Section size="compact" bordered>
        <GroupHeading>Last session</GroupHeading>
        <Link href="/student/remediation/B" className="block">
          <ListRow
            leading={<StatusMark status="diagnosed" />}
            title="Rounding to decimal places"
            meta="Study note ready to read"
          />
        </Link>
      </Section>

      <Section size="compact" bordered>
        <GroupHeading>Where to go next</GroupHeading>
        <LinkRow
          href="/student/start"
          title="New diagnostic"
          description="Pick a subject and a topic, then answer one question at a time."
        />
        <LinkRow
          href="/student/insights"
          title="My learning pace"
          description="How quickly your past misconceptions were resolved."
        />
        <LinkRow
          href="/student/consultant"
          title="Ask the consultant"
          description="A scripted assistant for your own sessions."
        />
      </Section>
    </Container>
  );
}
