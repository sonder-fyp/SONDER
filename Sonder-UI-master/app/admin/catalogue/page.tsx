"use client";

import { useMemo, useState } from "react";
import {
  Container,
  PageMasthead,
  Section,
  GroupHeading,
} from "@/components/layout";
import { FilterStrip } from "@/components/app/FilterStrip";
import { MisconceptionCard } from "@/components/shared";
import { EmptyState } from "@/components/app/EmptyState";
import { Input } from "@/components/ui/input";
import { CATALOGUE } from "@/fixtures/catalogue";

type SubjectFilter = "all" | "mathematics" | "physics" | "chemistry";
type StatusFilter = "all" | "validated" | "pending" | "catalogued-only";

export default function CatalogueBrowser() {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState<SubjectFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const results = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return CATALOGUE.filter((c) => {
      if (subject !== "all" && c.subject !== subject) return false;
      if (status !== "all" && c.status !== status) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.description.toLowerCase().includes(needle) ||
        c.code.toLowerCase().includes(needle)
      );
    });
  }, [q, subject, status]);

  const bySubject = useMemo(() => {
    const groups: Record<string, typeof results> = {};
    for (const c of results) {
      (groups[c.subject] ??= []).push(c);
    }
    return groups;
  }, [results]);

  return (
    <Container>
      <PageMasthead
        label="Catalogue"
        title="Misconception catalogue"
        lede="The validated set of misconceptions the engine can diagnose, per subject."
      />

      <div className="sticky top-[var(--topbar-h)] z-20 space-y-4 border-b border-border bg-background py-4">
        <label htmlFor="catalogue-search" className="sr-only">
          Search name, description or code
        </label>
        <Input
          id="catalogue-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, description or code"
        />
        <div className="flex flex-wrap items-center gap-8">
          <FilterStrip
            label="Filter by subject"
            value={subject}
            onChange={setSubject}
            options={[
              { value: "all", label: "All" },
              { value: "mathematics", label: "Mathematics" },
              { value: "physics", label: "Physics" },
              { value: "chemistry", label: "Chemistry" },
            ]}
          />
          <FilterStrip
            label="Filter by validation status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Any status" },
              { value: "validated", label: "Validated" },
              { value: "pending", label: "Pending" },
              { value: "catalogued-only", label: "Catalogued only" },
            ]}
          />
        </div>
      </div>

      <Section size="compact">
        <p className="mb-8 text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "entry" : "entries"}
        </p>

        {Object.entries(bySubject).map(([subj, entries]) => (
          <div key={subj} className="mb-16 last:mb-0">
            <GroupHeading count={entries.length}>{cap(subj)}</GroupHeading>
            <div className="border-t border-border">
              {entries.map((c) => (
                <MisconceptionCard
                  key={`${c.subject}-${c.code}`}
                  code={c.code}
                  name={c.name}
                  description={c.description}
                  status={c.status}
                />
              ))}
            </div>
          </div>
        ))}

        {results.length === 0 ? (
          <EmptyState
            title="Nothing matches that search"
            body="Try a broader term, or clear the subject filter."
          />
        ) : null}
      </Section>
    </Container>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
