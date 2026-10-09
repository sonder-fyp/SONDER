import Link from "next/link";
import { notFound } from "next/navigation";
import { LEARN_PAGES, getLearnPage } from "@/fixtures/learn/pages";
import { ResourceFinder } from "@/components/learn/ResourceFinder";
import { ConceptChat } from "@/components/learn/ConceptChat";
import {
  Container,
  PageMasthead,
  Section,
  GroupHeading,
  MetaList,
} from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";

export function generateStaticParams() {
  return LEARN_PAGES.map((p) => ({ subject: p.subject, code: p.code }));
}

export default async function LearnPageRoute({
  params,
}: {
  params: Promise<{ subject: string; code: string }>;
}) {
  const { subject, code } = await params;
  const page = getLearnPage(subject, code);
  if (!page) notFound();

  return (
    <Container>
      <PageMasthead
        label="Concept"
        title={page.title}
        meta={
          <div>
            <MetaList
              items={[
                { label: "Subject", value: cap(page.subject) },
                { label: "Code", value: page.code },
              ]}
            />
            <Link
              href="/student/start"
              className={buttonVariants({ variant: "outline", className: "mt-8" })}
            >
              Start a diagnostic
            </Link>
          </div>
        }
      />

      <Section id="notes" size="tight" bordered>
        <div className="prose-editorial">
          <h2>What this is</h2>
          <p>{page.whatItIs}</p>
          <h2>How to think about it</h2>
          <p>{page.howToThink}</p>
        </div>
        <MetaList
          className="mt-12"
          items={[
            { label: "Prompt", value: page.example.prompt },
            { label: "The usual slip", value: page.example.wrongMove },
            { label: "The fix", value: page.example.rightMove },
            {
              label: "Answer",
              value: (
                <span className="font-mono text-accent">{page.example.answer}</span>
              ),
            },
          ]}
        />
      </Section>

      <Section id="resources" size="tight" bordered>
        <GroupHeading>Recommended resources</GroupHeading>
        <div className="mt-8">
          <ResourceFinder query={page.searchQuery} resources={page.resources} />
        </div>
      </Section>

      <Section size="tight" bordered>
        <GroupHeading>Ask about this concept</GroupHeading>
        <div className="mt-8">
          <ConceptChat chat={page.chat} />
        </div>
      </Section>
    </Container>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
