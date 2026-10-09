"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Container, PageMasthead, GroupHeading } from "@/components/layout";
import { FilterStrip } from "@/components/app/FilterStrip";
import { EmptyState } from "@/components/app/EmptyState";
import { Mark } from "@/components/shared";
import { Label } from "@/components/type";
import { CATALOGUE } from "@/fixtures/catalogue";
import { SUBJECTS } from "@/fixtures/subjects";
import { learnPageHref } from "@/fixtures/learn/pages";
import type { Subject } from "@/fixtures/scenarios/types";
import { cn } from "@/lib/utils";

type Filter = "all" | Subject;

export default function LearnHub() {
  const [subject, setSubject] = useState<Filter>("all");
  const [onlyBuilt, setOnlyBuilt] = useState(false);

  const subjects = useMemo(
    () => (subject === "all" ? SUBJECTS : SUBJECTS.filter((s) => s.key === subject)),
    [subject],
  );

  const groups = subjects
    .map((s) => {
      const entries = CATALOGUE.filter((c) => {
        if (c.subject !== s.key) return false;
        if (!onlyBuilt) return true;
        return !!learnPageHref(c.subject, c.code);
      });
      return { subject: s, entries };
    })
    .filter((g) => g.entries.length > 0);

  return (
    <Container>
      <PageMasthead
        label="Learn"
        title="Every misconception we know about."
        lede="Browse the full catalogue across all three subjects, whether or not you have ever been diagnosed with one."
      />

      <div className="sticky top-[var(--topbar-h)] z-20 flex flex-wrap items-center gap-8 border-b border-border bg-background">
        <FilterStrip
          label="Filter by subject"
          value={subject}
          onChange={setSubject}
          options={[
            { value: "all", label: "All", count: CATALOGUE.length },
            {
              value: "mathematics",
              label: "Mathematics",
              count: CATALOGUE.filter((c) => c.subject === "mathematics").length,
            },
            {
              value: "physics",
              label: "Physics",
              count: CATALOGUE.filter((c) => c.subject === "physics").length,
            },
            {
              value: "chemistry",
              label: "Chemistry",
              count: CATALOGUE.filter((c) => c.subject === "chemistry").length,
            },
          ]}
        />
        <button
          type="button"
          aria-pressed={onlyBuilt}
          onClick={() => setOnlyBuilt((v) => !v)}
          className={cn(
            "label relative shrink-0 py-4 transition-colors duration-150 ease-[var(--ease)]",
            onlyBuilt ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          Only built out
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent transition-transform duration-150",
              onlyBuilt ? "scale-x-100" : "scale-x-0",
            )}
          />
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="Nothing matches those filters." />
      ) : (
        groups.map(({ subject: s, entries }) => (
          <div key={s.key} className="py-16 md:py-20">
            <GroupHeading count={entries.length}>{s.name}</GroupHeading>
            <div className="border-t border-border">
              {entries.map((c) => {
                const href = learnPageHref(c.subject, c.code);
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="label nums text-faint">{c.code}</span>
                      <span className="mt-3 block text-xl font-semibold tracking-tight">
                        {c.name}
                      </span>
                      <span className="mt-2 block text-base text-muted-foreground">
                        {c.description}
                      </span>
                    </span>
                    {href ? (
                      <Label tone="accent" as="span">
                        Open
                      </Label>
                    ) : (
                      <Mark bucket="inert">Notes coming soon</Mark>
                    )}
                  </>
                );
                if (href) {
                  return (
                    <Link
                      key={`${c.subject}-${c.code}`}
                      href={href}
                      className="group flex min-h-16 items-start justify-between gap-6 border-b border-border py-6 transition-colors duration-150 hover:bg-muted"
                    >
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div
                    key={`${c.subject}-${c.code}`}
                    className="flex min-h-16 cursor-not-allowed items-start justify-between gap-6 border-b border-border py-6 opacity-55"
                  >
                    {inner}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </Container>
  );
}
