"use client";
import Link from "next/link";
import { Container } from "@/components/layout";
import { Button, buttonVariants } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="py-16">
      <p className="label text-attention">Something went wrong</p>
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">
        We could not open this page.
      </h1>
      <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
        Try loading it again. If the problem continues, return to Sonder and
        sign in again.
      </p>
      <div className="mt-8 flex flex-wrap gap-6">
        <Button onClick={reset}>Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          Return to Sonder
        </Link>
      </div>
    </Container>
  );
}
