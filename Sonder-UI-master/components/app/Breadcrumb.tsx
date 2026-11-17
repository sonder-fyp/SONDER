"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEGMENT_LABELS } from "@/lib/nav";

/** Context labels never display record IDs or link to nonexistent route parents. */
export function Breadcrumb() {
  const parts = usePathname().split("/").filter(Boolean);
  if (!parts.length) return null;
  const section = parts[1];
  const current =
    parts.length > 2
      ? section === "diagnostic"
        ? "Topic diagnostic"
        : "Details"
      : (SEGMENT_LABELS[section] ?? "Overview");
  return (
    <nav
      aria-label="Breadcrumb"
      className="topbar-breadcrumb hidden min-w-0 items-center gap-3 text-sm md:flex"
    >
      {section ? (
        <>
          <Link
            href={`/${parts[0]}`}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            {SEGMENT_LABELS[parts[0]] ?? "Overview"}
          </Link>
          <span aria-hidden className="text-faint">
            /
          </span>
        </>
      ) : null}
      <span aria-current="page" className="truncate">
        {section ? current : (SEGMENT_LABELS[parts[0]] ?? "Overview")}
      </span>
    </nav>
  );
}
