"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { chromeMode, LANDING_CHROME_SENTINEL_ID } from "@/lib/chrome";
import { useSession } from "@/lib/session";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { BrandMark } from "./BrandMark";
import { Breadcrumb } from "./Breadcrumb";
import { RoleMenu } from "./RoleMenu";
import { MobileNav } from "./MobileNav";
import { MusicToggle } from "./MusicToggle";
import { ThemeToggle } from "./ThemeToggle";

/**
 * One persistent header. Inner slots swap with the route; the <header className="topbar">
 * node itself is never keyed and must not unmount when crossing landing and product.
 * Fixed to the viewport so the GSAP-pinned hero cannot cover it. No blur, no pill, no shadow.
 */
export function TopBar() {
  const pathname = usePathname();
  const landing = chromeMode(pathname) === "landing";
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  if (!landing && (scrolled || navOpen)) {
    setScrolled(false);
    setNavOpen(false);
  }

  useEffect(() => {
    if (!landing) return;

    let io: IntersectionObserver | null = null;
    const observe = (el: Element) => {
      io = new IntersectionObserver(
        ([entry]) => setScrolled(!entry.isIntersecting),
        { threshold: 0 },
      );
      io.observe(el);
    };

    const existing = document.getElementById(LANDING_CHROME_SENTINEL_ID);
    if (existing) {
      observe(existing);
      return () => io?.disconnect();
    }

    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(LANDING_CHROME_SENTINEL_ID);
      if (el) observe(el);
    });
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [landing]);

  return (
    <>
      <header
        role="banner"
        className={cn(
          // Fixed so the GSAP-pinned hero cannot cover it. Landing is an overlay
          // on the poster (transparent until the sentinel); product is opaque and
          // a matching-height spacer below preserves in-flow layout.
          "topbar fixed inset-x-0 top-0 z-50 h-[var(--topbar-h)]",
          landing
            ? cn(
                "border-b transition-colors duration-200 ease-[var(--ease)]",
                scrolled
                  ? "border-border bg-background"
                  : "border-transparent bg-transparent",
              )
            : "border-b border-border bg-background",
        )}
      >
        {landing ? <LandingSlots /> : <ProductSlots navOpen={navOpen} onOpenNav={() => setNavOpen(true)} />}
      </header>

      {landing ? null : (
        <>
          <div aria-hidden className="h-[var(--topbar-h)] shrink-0" />
          <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
        </>
      )}
    </>
  );
}

function LandingSlots() {
  const { signIn } = useSession();

  return (
    <nav
      aria-label="Landing"
      className="mx-auto flex h-full max-w-[1440px] items-center gap-6 px-6 md:gap-8 md:px-12 lg:px-16"
    >
      <a
        href="#top"
        aria-label="Sonder, back to top"
        className="shrink-0 text-foreground transition-colors duration-150 hover:text-accent"
      >
        <BrandMark size={36} />
      </a>

      <div className="ml-auto flex min-w-0 items-center gap-4 overflow-x-auto md:gap-8">
        <a
          href="#narrative"
          className="label group relative hidden min-h-11 shrink-0 items-center py-2 text-muted-foreground transition-colors duration-150 hover:text-foreground sm:flex"
        >
          How it works
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-2 h-px origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
          />
        </a>
        {ROLE_ORDER.map((role) => {
          const meta = ROLES[role];
          return (
            <Link
              key={role}
              href={meta.home}
              onClick={() => signIn(role)}
              className="label group relative flex min-h-11 shrink-0 items-center text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {meta.label}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-2 h-px origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
              />
            </Link>
          );
        })}
      </div>
      <ThemeToggle />
      <MusicToggle />
    </nav>
  );
}

function ProductSlots({
  navOpen,
  onOpenNav,
}: {
  navOpen: boolean;
  onOpenNav: () => void;
}) {
  return (
    <div className="flex h-full min-w-0 w-full items-center gap-4 pl-6 pr-4 md:gap-8 md:pl-8 md:pr-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        aria-expanded={navOpen}
        className="topbar-menu -ml-2 grid size-11 shrink-0 place-items-center text-muted-foreground transition-colors duration-150 hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" strokeWidth={1.5} aria-hidden />
      </button>

      <Link
        href="/"
        aria-label="Sonder, back to the landing page"
        className="shrink-0 text-foreground transition-colors duration-150 hover:text-accent"
      >
        <BrandMark size={36} />
      </Link>

      <span aria-hidden className="hidden h-6 w-px shrink-0 bg-border md:block" />

      <Breadcrumb />

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <MusicToggle />
        <RoleMenu />
      </div>
    </div>
  );
}
