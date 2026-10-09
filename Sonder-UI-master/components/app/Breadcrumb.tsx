"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEGMENT_LABELS } from "@/lib/nav";

/**
 * Mono, uppercase, slash-separated. Every segment except the last links to its
 * own path; the last is the current page and is not a link.
 * Labels come from SEGMENT_LABELS where a mapping exists, else the raw segment
 * is de-hyphenated and capitalised.
 */
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label:
      SEGMENT_LABELS[seg] ??
      seg.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
    last: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className="topbar-breadcrumb label hidden min-w-0 items-center gap-3 md:flex"
    >
      {crumbs.map((c) => (
        <span key={c.href} className="flex min-w-0 items-center gap-3">
          {c.last ? (
            <span className="truncate text-foreground" aria-current="page">
              {c.label}
            </span>
          ) : (
            <>
              <Link
                href={c.href}
                className="shrink-0 text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                {c.label}
              </Link>
              <span aria-hidden className="shrink-0 text-decorative">
                /
              </span>
            </>
          )}
        </span>
      ))}
    </nav>
  );
}
