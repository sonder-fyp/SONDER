import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Users,
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Container, PageMasthead } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import type { AppAccount } from "@/lib/auth/types";

export function WorkspaceHome({ account }: { account: AppAccount }) {
  const role = account.role;
  const firstName = account.display_name.trim().split(/\s+/)[0];
  const student = role === "student";
  const admin = role === "admin";
  const title = student
    ? `Welcome, ${firstName}`
    : admin
      ? "Your administration workspace"
      : role === "teacher"
        ? "Your teaching workspace"
        : "Your family workspace";
  const description = student
    ? "Take a little time to understand how you think. Pick a topic and work through one question at a time."
    : admin
      ? "Manage account access and keep Sonder ready for the people who use it."
      : role === "teacher"
        ? "A clear place for your classes, student work and follow-up."
        : "A place for your child's learning summaries and the next steps shared with you.";
  return (
    <Container className="pb-20">
      <PageMasthead
        label={student ? "Your learning" : "Overview"}
        title={title}
        lede={description}
        actions={
          student || admin ? (
            <Link
              href={student ? "/student/start" : "/admin/access"}
              className={buttonVariants({ size: "lg" })}
            >
              {student ? "Explore diagnostics" : "Review access requests"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      {student ? (
        <section className="grid gap-8 py-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:py-14">
          <div className="border border-border bg-background/70 p-6 md:p-8">
            <Compass
              className="size-7 text-accent"
              strokeWidth={1.25}
              aria-hidden
            />
            <p className="label mt-8 text-accent">Your next step</p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Start with a topic.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
              Choose an available Mathematics topic. If you already have a check
              in progress, you can continue it from the same topic.
            </p>
            <Link
              href="/student/start"
              className="mt-6 inline-flex min-h-11 items-center gap-3 text-sm font-medium hover:text-accent"
            >
              Find a diagnostic
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="py-3">
            <p className="label text-muted-foreground">Before you begin</p>
            <ol className="mt-5 divide-y divide-border">
              {[
                "Work at your own pace. There is no timer.",
                "Answer as best you can. This is not a graded test.",
                "Submitted answers are saved so you can return later.",
              ].map((text, index) => (
                <li key={text} className="flex gap-5 py-5">
                  <span className="label text-accent">0{index + 1}</span>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section className="grid gap-10 py-10 md:grid-cols-2 md:py-14">
          <OverviewArea
            icon={admin ? ShieldCheck : Users}
            title={
              admin
                ? "Account access"
                : role === "teacher"
                  ? "Classes and assignments"
                  : "Linked children"
            }
            description={
              admin
                ? "Review teacher and parent registrations. Each request is saved to the account service."
                : role === "teacher"
                  ? "Class management and assignments are not available yet. They will appear here when ready."
                  : "Child linking is not available yet. Summaries will only be accessible through an authorised connection to your child."
            }
          />
          <OverviewArea
            icon={role === "parent" ? BookOpen : ClipboardCheck}
            title={
              admin
                ? "Content and reporting"
                : role === "teacher"
                  ? "Student work and reviews"
                  : "Learning summaries"
            }
            description={
              admin
                ? "Catalogue management and reporting are not available yet. No example statistics are shown here."
                : role === "teacher"
                  ? "The review queue is not available yet. Completed diagnostics will appear here once class-scoped review is connected."
                  : "Summaries are not available yet. Only information released for your account will appear here."
            }
          />
        </section>
      )}
    </Container>
  );
}
function OverviewArea({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="border-t border-border pt-8">
      <Icon className="size-7 text-accent" strokeWidth={1.25} aria-hidden />
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
