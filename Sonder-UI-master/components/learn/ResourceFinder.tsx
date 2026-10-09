"use client";

import { useEffect, useState } from "react";
import type { LearnResource } from "@/fixtures/learn/types";
import { Label } from "@/components/type";

const SEARCH_MS = 800;

const KIND_LABEL = {
  video: "Video",
  article: "Article",
  interactive: "Interactive",
} as const;

/**
 * Scripted "search the web, then rank results". No real search runs: the query
 * and every result are fixture data. The sequence is honest because it is
 * labelled scripted, per BLUEPRINT section 5.
 */
export function ResourceFinder({
  query,
  resources,
}: {
  query: string;
  resources: LearnResource[];
}) {
  const [phase, setPhase] = useState<"searching" | "done">("searching");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("done"), SEARCH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (phase === "searching") {
    return (
      <div role="status" className="border-t border-border py-8">
        <p className="text-base text-muted-foreground">
          Searching the web for &ldquo;{query}&rdquo;
        </p>
        <div className="mt-6 w-40">
          <div className="rule-sweep" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Picked by Sonder from a search of the web, ranked by fit to this
        misconception. Scripted.
      </p>

      <div className="mt-8 border-t border-border">
        {resources.map((r) => (
          <a
            key={r.url}
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-baseline justify-between gap-8 border-b border-border py-6 transition-colors duration-150 hover:border-border-hover"
          >
            <span className="min-w-0">
              <span className="flex items-baseline gap-4">
                <Label tone="faint" as="span">
                  {KIND_LABEL[r.kind]}
                </Label>
                <span className="relative min-w-0 text-lg font-medium leading-snug">
                  {r.title}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
                  />
                </span>
              </span>
              <span className="mt-2 block text-sm text-muted-foreground">{r.source}</span>
              <span className="mt-2 block max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {r.rationale}
              </span>
            </span>
            <span className="nums shrink-0 font-mono text-sm text-accent">
              {r.relevance.toFixed(2)}
              <span className="sr-only"> relevance score</span>
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
