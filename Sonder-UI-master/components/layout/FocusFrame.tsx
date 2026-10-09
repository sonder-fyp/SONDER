"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Do one thing." Sets data-focus on <html>, which CSS in the app shell uses to
 * hide the workspace nav and the breadcrumb, leaving the top bar's wordmark and
 * one explicit exit link. Navigation is suppressed, never removed: a student
 * who wants out must not need the browser back button.
 *
 * The cleanup is mandatory. Without it every later route renders with its nav
 * hidden.
 */
export function FocusFrame({
  progress,
  exitHref,
  exitLabel = "Leave this screen",
  children,
  className,
}: {
  progress?: { current: number; total: number };
  exitHref: string;
  exitLabel?: string;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.focus = "true";
    return () => {
      delete root.dataset.focus;
    };
  }, []);

  const pct = progress
    ? Math.min(100, Math.max(0, (progress.current / progress.total) * 100))
    : 0;

  return (
    <>
      {progress ? (
        <div
          role="progressbar"
          aria-label="Progress through this task"
          aria-valuenow={progress.current}
          aria-valuemin={0}
          aria-valuemax={progress.total}
          className="fixed inset-x-0 top-0 z-50 h-0.5 bg-border"
        >
          <div
            className="h-full bg-accent transition-[width] duration-500 ease-[var(--ease)] motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      <div className={cn("mx-auto w-full max-w-[720px] px-6 py-20 md:py-28", className)}>
        <Link
          href={exitHref}
          className="label group relative inline-flex min-h-11 items-center gap-3 text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden />
          {exitLabel}
        </Link>

        <div className="mt-12">{children}</div>
      </div>
    </>
  );
}
