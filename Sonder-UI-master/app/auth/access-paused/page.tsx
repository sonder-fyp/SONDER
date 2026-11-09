import Link from "next/link";

export default function AccessPausedPage() {
  return (
    <section className="mx-auto w-full max-w-[480px]">
      <p className="label text-accent">Account access</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">Access is paused.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        This account cannot open a Sonder workspace right now. Contact your school administrator for help.
      </p>
      <Link href="/" className="label mt-8 inline-flex min-h-11 items-center text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Return to Sonder
      </Link>
    </section>
  );
}
