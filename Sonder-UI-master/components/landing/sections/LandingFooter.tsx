import Link from "next/link";
import { MusicToggle } from "@/components/app/MusicToggle";
import { Container } from "@/components/layout";
import { BrandMark } from "@/components/app/BrandMark";

export function LandingFooter() {
  return (
    <footer className="border-t border-border">
      <Container className="py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:gap-20">
          <div>
            <BrandMark size={36} />
            <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
              Beyond right or wrong. A clearer understanding of the idea behind
              an answer.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-start gap-x-8 gap-y-3 text-sm"
          >
            <a href="#narrative" className="min-h-11 py-3 hover:text-accent">
              How it works
            </a>
            <a href="#educators" className="min-h-11 py-3 hover:text-accent">
              For educators
            </a>
            <Link
              href="/auth/sign-in"
              className="min-h-11 py-3 hover:text-accent"
            >
              Log in
            </Link>
          </nav>
        </div>
        <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
          <span>Background music</span>
          <MusicToggle />
        </div>
        <p className="label mt-12 border-t border-border pt-6 text-faint">
          © {new Date().getFullYear()} Sonder
        </p>
      </Container>
    </footer>
  );
}
