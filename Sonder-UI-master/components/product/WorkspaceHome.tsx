import Link from "next/link";
import {
  ArrowRight,
  Users,
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
} from "lucide-react";
import { Container, PageMasthead } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";
import type { AppAccount } from "@/lib/auth/types";

/** children appear right under the heading, before the general guidance. */
export function WorkspaceHome({ account, children }: { account: AppAccount; children?: React.ReactNode }) {
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
    ? "Your teachers' assignments are below. Work through one question at a time; your answers are saved as you go."
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
          admin || role === "teacher" ? (
            <Link
              href={admin ? "/admin/access" : "/teacher/classes"}
              className={buttonVariants({ size: "lg" })}
            >
              {admin ? "Review access requests" : "Manage classes"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      {children}
      {student ? (
        <section className="py-10 lg:py-14">
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
                  ? "Create Mathematics classes, share each class's join code with your students and assign them a topic."
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
                  ? "Open a class to see who has started and finished each assignment, read a check question by question and record your review."
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
