"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Heading, Label } from "@/components/type";
import { MetaList } from "@/components/layout";
import { EvidenceStep, OutcomeBanner, PosteriorBarSet } from "@/components/shared";
import type { TeacherOutcome, TeacherResult } from "@/lib/diagnostic/types";

const POLL_MS = 3000;

const OUTCOME_TITLE: Record<TeacherOutcome, string> = {
  diagnosed: "Misconception identified",
  none_detected: "No misconception detected",
  escalated_no_separator: "Could not separate",
  escalated_exhausted: "Ran out of questions",
  escalated_unmodelled: "Outside the catalogue",
};

function bannerMessage(result: TeacherResult) {
  if (result.outcome === "diagnosed") return `${result.leader_name} (${result.leader})`;
  if (result.outcome === "escalated_no_separator" && result.tied.length) {
    return result.tied.join(" and ");
  }
  return result.detail;
}

/**
 * Teacher notice for the diagnostic that finished last. Polls the demo route, shows a
 * toast when a new run is ready, and opens its result in an overlay. Read only: nothing
 * is saved and nothing is approved here.
 */
export function LatestDiagnosticNotice() {
  const [result, setResult] = useState<TeacherResult | null>(null);
  const [open, setOpen] = useState(false);
  const announced = useRef<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  const show = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    opener.current?.focus();
  }, []);

  // Poll for the run that finished last.
  useEffect(() => {
    let alive = true;
    async function check() {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/teacher/latest-diagnostic", { cache: "no-store" });
        if (!alive || !response.ok) return;
        const next = (await response.json()) as TeacherResult;
        if (!alive) return;
        setResult(next);
        if (announced.current !== next.session_id) {
          announced.current = next.session_id;
          toast("A diagnostic is ready to review", {
            description: `${next.unit.name} (${next.unit.unit_id}) · ${next.answered_count} questions`,
            action: { label: "View", onClick: show },
            duration: 20000,
          });
        }
      } catch {
        // The notice stays quiet when the service is not reachable.
      }
    }
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [show]);

  // Escape closes; page scroll is locked and focus moves in while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (!result) return null;

  const leader = result.hypotheses.find((h) => h.id === result.leader);
  const facts = [
    { label: "Outcome", value: OUTCOME_TITLE[result.outcome] },
    { label: "Rule", value: result.rule },
    { label: "Leader", value: leader ? `${leader.id} · ${leader.final.toFixed(4)}` : result.leader },
    { label: "Support", value: leader ? `${leader.support} answers` : "-" },
    { label: "Questions", value: `${result.answered_count} of ${result.question_budget}` },
    ...(result.tied.length ? [{ label: "Tied", value: result.tied.join(", ") }] : []),
    { label: "Session", value: <span className="break-all font-mono text-xs">{result.session_id}</span> },
  ];

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <Button variant="outline" onClick={show}>
          Latest diagnostic
        </Button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute inset-0 bg-background/90"
          />

          <div className="absolute inset-x-4 bottom-4 top-[calc(var(--topbar-h)+1rem)] mx-auto flex max-w-3xl flex-col border border-border bg-background">
            <div className="flex h-[var(--topbar-h)] shrink-0 items-center justify-between border-b border-border px-6">
              <Label tone="muted">Diagnostic · {result.unit.unit_id}</Label>
              <button
                ref={closeButton}
                type="button"
                onClick={close}
                aria-label="Close"
                className="grid size-11 place-items-center text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                <X className="size-5" strokeWidth={1.5} aria-hidden />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
              <div id={titleId}>
                <Heading scale="item">{result.unit.name}</Heading>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.answered_count} of {result.question_budget} questions
              </p>

              <OutcomeBanner
                className="mt-8"
                type={result.outcome === "diagnosed" ? "diagnosed" : "unsure"}
                title={OUTCOME_TITLE[result.outcome]}
                message={bannerMessage(result)}
              />

              <MetaList className="mt-10" items={facts} />

              <Label tone="muted" className="mt-12">
                Final probabilities
              </Label>
              <PosteriorBarSet
                className="mt-4"
                hypotheses={result.hypotheses.map((h) => ({
                  id: h.id,
                  label: `${h.id} · ${h.name}`,
                  probability: h.final,
                }))}
                diagnosisThreshold={0.8}
                tieEpsilon={result.outcome === "escalated_no_separator" ? 0.05 : -1}
                caption={result.detail}
              />

              <Label tone="muted" className="mt-12">
                Evidence
              </Label>
              <div className="mt-4 border-t border-border">
                {result.steps.map((step, index) => (
                  <EvidenceStep
                    key={step.step_index}
                    index={step.step_index + 1}
                    questionText={step.item_id}
                    answerGiven={step.answer_note}
                    reasoning={step.reason}
                    isCurrent={index === result.steps.length - 1}
                  />
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-border px-6 py-4">
              <Label tone="faint">Demo view · not saved · not approved</Label>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
