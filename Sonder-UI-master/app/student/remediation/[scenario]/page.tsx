import Link from "next/link";
import { notFound } from "next/navigation";
import { getScenario } from "@/fixtures/scenarios";
import { learnPageHref } from "@/fixtures/learn/pages";
import { Container, PageMasthead, Section, Split, MetaList } from "@/components/layout";
import { Mark } from "@/components/shared";
import { buttonVariants } from "@/components/ui/button";
import { MarkReadButton } from "./MarkReadButton";

export function generateStaticParams() {
  return [{ scenario: "A" }, { scenario: "B" }];
}

export default async function RemediationPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  const { scenario: id } = await params;
  const scenario = getScenario(id);
  const note = scenario?.studyNote;
  if (!scenario || !note) notFound();
  const learnHref = learnPageHref(scenario.subject, note.code);

  return (
    <Container>
      <PageMasthead
        label="Study note"
        title={note.name}
        lede={`For ${scenario.topicName}. Read this in your own time. It is yours to come back to.`}
      />

      <Section size="tight">
        <Split
          ratio="8/4"
          sticky
          primary={
            <>
              <div className="prose-editorial">
                <h2>What was going on</h2>
                <p>{note.explanation}</p>
                <h2>How to think about it</h2>
                <p>{note.correction}</p>
              </div>
              <a
                href={note.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group mt-12 flex min-h-16 items-baseline justify-between gap-6 border-t border-b border-border py-5"
              >
                <span className="min-w-0">
                  <span className="relative inline-block text-lg font-medium">
                    {note.videoTitle}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
                    />
                  </span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    Opens on YouTube
                  </span>
                </span>
              </a>
            </>
          }
          secondary={
            <div>
              <Mark bucket="confirmed">Teacher approved</Mark>
              <p className="mt-4 text-sm text-muted-foreground">
                Shared with you after your teacher reviewed the diagnosis.
              </p>
              <MetaList
                className="mt-10"
                items={[
                  { label: "Subject", value: cap(scenario.subject) },
                  { label: "Topic", value: scenario.topicName },
                  { label: "Code", value: note.code },
                ]}
              />
              <div className="mt-10 flex flex-col items-start gap-6">
                <MarkReadButton />
                {scenario.verification ? (
                  <Link
                    href={`/student/verify/${scenario.id}`}
                    className={buttonVariants({ variant: "ghost" })}
                  >
                    Preview the follow-up check
                  </Link>
                ) : null}
                {learnHref ? (
                  <Link href={learnHref} className={buttonVariants({ variant: "ghost" })}>
                    Learn more about this
                  </Link>
                ) : null}
              </div>
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
