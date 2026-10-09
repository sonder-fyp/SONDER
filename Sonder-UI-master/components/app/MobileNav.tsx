"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { NAV, isNavItemActive } from "@/lib/nav";
import { BrandMark } from "./BrandMark";

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { role } = useSession();

  // Close on navigation.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Escape closes; body scroll is locked while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !role) return null;

  const groups = NAV[role];
  const meta = ROLES[role];

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-background/90"
      />

      <div className="absolute inset-y-0 left-0 flex w-[min(320px,85vw)] flex-col border-r border-border bg-background">
        <div className="flex h-[var(--topbar-h)] shrink-0 items-center justify-between border-b border-border px-6">
          <BrandMark size={36} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-11 place-items-center text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            <X className="size-5" strokeWidth={1.5} aria-hidden />
          </button>
        </div>

        <p className="label shrink-0 px-6 pb-6 pt-8 text-muted-foreground">
          {meta.label} workspace
        </p>

        <nav
          aria-label={`${meta.label} workspace`}
          className="app-scroll min-h-0 flex-1 overflow-y-auto pb-8"
        >
          {groups.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-6 border-t border-border pt-6")}>
              {group.label ? (
                <p className="label px-6 pb-3 text-muted-foreground">{group.label}</p>
              ) : null}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, item, meta.home);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-14 items-center gap-4 px-6 text-base",
                      "transition-colors duration-150",
                      active
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 bg-accent" />
                    ) : null}
                    <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}
