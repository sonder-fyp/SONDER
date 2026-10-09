"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type RouteTab = {
  label: string;
  href: string;
  startsWith?: boolean;
  disabled?: boolean;
};

/**
 * Tabs as underlined mono labels on a hairline. The active tab carries a 2px
 * accent rule; inactive tabs draw a hairline in on hover. No pills, no fills.
 */
export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="app-scroll -mb-px flex gap-8 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const active = t.startsWith
          ? pathname === t.href || pathname.startsWith(t.href + "/")
          : pathname === t.href;

        if (t.disabled) {
          return (
            <span
              key={t.href}
              aria-disabled="true"
              className="label shrink-0 cursor-not-allowed py-4 text-faint"
            >
              {t.label}
            </span>
          );
        }

        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "label group relative shrink-0 py-4 transition-colors duration-150 ease-[var(--ease)]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-0 bottom-0 h-0.5 origin-left transition-transform duration-150 ease-[var(--ease)]",
                active
                  ? "scale-x-100 bg-accent"
                  : "scale-x-0 bg-border-hover group-hover:scale-x-100",
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
