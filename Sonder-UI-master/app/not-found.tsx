"use client";
import Link from "next/link";
import { Container } from "@/components/layout";
import { Label, LayeredNumber, AccentBar } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/session";
export default function NotFound() {
  const { account } = useSession();
  return (
    <Container className="relative py-24">
      <LayeredNumber value="404" className="right-0 top-10" />
      <Label tone="accent">Page not found</Label>
      <h1 className="mt-8 max-w-[16ch] text-4xl font-semibold leading-tight tracking-tighter sm:text-5xl">
        This page is out of reach.
      </h1>
      <AccentBar className="mt-8" />
      <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
        The link may have changed, or the page may no longer be available.
        Return to a familiar place to continue.
      </p>
      <Link
        href={account ? "/auth/continue" : "/"}
        className={`${buttonVariants()} mt-10`}
      >
        {account ? "Back to dashboard" : "Back to Sonder"}
      </Link>
    </Container>
  );
}
