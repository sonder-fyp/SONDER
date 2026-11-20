import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleDashed } from "lucide-react";
import { Container, PageMasthead } from "@/components/layout";
import { buttonVariants } from "@/components/ui/button";

export function WorkspaceState({
  label,
  title,
  description,
  detail,
  home,
  action,
  actionHref,
}: {
  label: string;
  title: string;
  description: string;
  detail: string;
  home: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <Container className="pb-20">
      <PageMasthead label={label} title={title} lede={description} />
      <section className="my-10 grid gap-8 border-y border-border py-10 md:my-14 md:grid-cols-[64px_1fr] md:py-14">
        <CircleDashed
          className="size-10 text-muted-foreground"
          strokeWidth={1}
          aria-hidden
        />
        <div className="max-w-xl">
          <p className="label text-muted-foreground">Not available yet</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            This part of Sonder is being prepared.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">{detail}</p>
          <div className="mt-8 flex flex-wrap items-center gap-8">
            <Link href={home} className={buttonVariants({ variant: "ghost" })}>
              <ArrowLeft className="size-4" aria-hidden />
              Back to overview
            </Link>
            {action && actionHref ? (
              <Link href={actionHref} className={buttonVariants()}>
                {action}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </Container>
  );
}
