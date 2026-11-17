"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { chromeMode, LANDING_CHROME_SENTINEL_ID } from "@/lib/chrome";
import { useSession } from "@/lib/session";
import { BrandMark } from "./BrandMark";
import { Breadcrumb } from "./Breadcrumb";
import { RoleMenu } from "./RoleMenu";
import { MobileNav } from "./MobileNav";
import { NavigationDrawer } from "./NavigationDrawer";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar() {
  const pathname = usePathname();
  const landing = chromeMode(pathname) === "landing";
  const { account, email } = useSession();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const open = openFor === pathname;

  useEffect(() => {
    if (!landing) return;
    let observer: IntersectionObserver | undefined;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(LANDING_CHROME_SENTINEL_ID);
      if (!el) return;
      observer = new IntersectionObserver(([entry]) =>
        setScrolled(!entry.isIntersecting),
      );
      observer.observe(el);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [landing]);

  return (
    <>
      <header
        className={cn(
          "topbar fixed inset-x-0 top-0 z-50 h-[var(--topbar-h)] border-b transition-colors duration-200",
          landing && !scrolled
            ? "border-transparent bg-transparent"
            : "border-border bg-background",
        )}
      >
        {landing ? (
          <nav
            aria-label="Public website"
            className="mx-auto flex h-full max-w-[1440px] items-center gap-2 px-4 sm:gap-4 sm:px-6 lg:gap-8 lg:px-12"
          >
            <Link href="/" aria-label="Sonder home" className="shrink-0">
              <BrandMark
                size={36}
                className="[&>span]:hidden sm:[&>span]:inline"
              />
            </Link>
            <div className="ml-auto hidden items-center gap-8 lg:flex">
              <PublicLinks />
            </div>
            <div className="ml-auto flex items-center gap-3 lg:ml-0">
              <AccountEntry />
              <ThemeToggle />
            </div>
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpenFor(pathname)}
              className="grid size-11 shrink-0 place-items-center lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
          </nav>
        ) : (
          <div className="flex h-full min-w-0 items-center gap-4 px-6 md:gap-8">
            <button
              type="button"
              aria-label="Open navigation"
              aria-expanded={open}
              onClick={() => setOpenFor(pathname)}
              className="topbar-menu grid size-11 shrink-0 place-items-center lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <Link
              href={account ? `/${account.role}` : "/auth/continue"}
              aria-label="Sonder dashboard"
              className="shrink-0"
            >
              <BrandMark
                size={36}
                className="[&>span]:hidden sm:[&>span]:inline"
              />
            </Link>
            <Breadcrumb />
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <span className="hidden sm:block">
                <ThemeToggle />
              </span>
              <RoleMenu />
            </div>
          </div>
        )}
      </header>
      {landing ? (
        <NavigationDrawer
          open={open}
          onClose={() => setOpenFor(null)}
          title="Explore Sonder"
        >
          <nav
            aria-label="Public mobile navigation"
            onClick={() => setOpenFor(null)}
            className="flex flex-col gap-6"
          >
            <PublicLinks />
            <Link
              href={account || email ? "/auth/continue" : "/auth/sign-in"}
              className="label min-h-11 py-3"
            >
              {account ? "Open dashboard" : email ? "Continue setup" : "Log in"}
            </Link>
          </nav>
        </NavigationDrawer>
      ) : (
        <>
          <div aria-hidden className="h-[var(--topbar-h)] shrink-0" />
          <MobileNav open={open} onClose={() => setOpenFor(null)} />
        </>
      )}
    </>
  );
}
function PublicLinks() {
  return (
    <>
      <a
        href="#narrative"
        className="flex min-h-11 items-center font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        How it works
      </a>
      <a
        href="#educators"
        className="flex min-h-11 items-center font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
      >
        For educators
      </a>
    </>
  );
}
function AccountEntry() {
  const { account, email, loading } = useSession();
  if (loading)
    return (
      <Link
        href="/auth/continue"
        className="flex min-h-11 items-center font-mono text-xs uppercase tracking-widest text-accent"
      >
        Continue
      </Link>
    );
  if (account || email)
    return (
      <Link
        href="/auth/continue"
        className="flex min-h-11 items-center font-mono text-xs uppercase tracking-widest text-accent"
      >
        {account ? "Open dashboard" : "Continue setup"}
      </Link>
    );
  return (
    <>
      <Link
        href="/auth/sign-in"
        className="hidden min-h-11 items-center font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground lg:flex"
      >
        Log in
      </Link>
      <Link
        href="/auth/sign-up"
        className="flex min-h-11 items-center font-mono text-xs uppercase tracking-widest text-accent"
      >
        Create account
      </Link>
    </>
  );
}
