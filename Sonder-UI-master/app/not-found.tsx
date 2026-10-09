"use client";

import Link from "next/link";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { Container } from "@/components/layout";
import { Label, LayeredNumber, AccentBar } from "@/components/type";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  const { role } = useSession();
  const home = role ? ROLES[role].home : "/";
  const label = role ? `Back to ${ROLES[role].label.toLowerCase()} home` : "Back to home";

  return (
    <Container className="relative py-28 md:py-40">
      <LayeredNumber value="404" className="right-0 top-10" />
      <Label tone="accent">Not found</Label>
      <h1 className="mt-8 max-w-[16ch] text-5xl font-bold leading-none tracking-tighter sm:text-6xl lg:text-7xl">
        Nothing here.
      </h1>
      <AccentBar className="mt-10" />
      <p className="mt-10 max-w-xl text-lg leading-relaxed text-muted-foreground">
        Every real screen is reachable from its own navigation. There is no page
        hiding behind a guessed URL.
      </p>
      <div className="mt-12">
        <Link href={home} className={buttonVariants()}>
          {label}
          <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden />
        </Link>
      </div>
    </Container>
  );
}
