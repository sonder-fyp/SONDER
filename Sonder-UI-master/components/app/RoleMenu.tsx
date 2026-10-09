"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useSession, type Role } from "@/lib/session";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function RoleMenu() {
  const { role, signIn, signOut } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Outside click and Escape. Both listeners are added on open and removed on
  // close, never left mounted.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const current = role ? ROLES[role] : null;

  const enter = (next: Role) => {
    signIn(next);
    setOpen(false);
    router.push(ROLES[next].home);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="label flex min-h-11 items-center gap-3 px-2 text-muted-foreground transition-colors duration-150 hover:text-foreground"
      >
        <span className="flex min-w-0 items-baseline gap-2">
          {current ? (
            <>
              <span className="shrink-0 text-foreground">{current.label}</span>
              <span className="hidden max-w-[14ch] truncate text-faint md:inline">
                {current.person}
              </span>
            </>
          ) : (
            "Choose a workspace"
          )}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
          strokeWidth={1.5}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Workspace"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(360px,calc(100vw-2rem))] border border-border-strong bg-card"
        >
          {current ? (
            <div className="border-b border-border p-6">
              <p className="label text-accent">{current.label}</p>
              <p className="mt-3 text-lg font-medium leading-snug">
                {current.person}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {current.context}
              </p>
            </div>
          ) : null}

          <p className="label px-6 pb-3 pt-6 text-muted-foreground">
            Switch workspace
          </p>

          {ROLE_ORDER.map((r) => {
            const meta = ROLES[r];
            const active = r === role;
            return (
              <button
                key={r}
                type="button"
                role="menuitem"
                onClick={() => enter(r)}
                className={cn(
                  "group relative flex min-h-14 w-full items-center justify-between gap-4 px-6 text-left",
                  "transition-colors duration-150 hover:bg-muted",
                  active && "bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-2 left-0 w-0.5 transition-colors duration-150 ease-[var(--ease)]",
                    active ? "bg-accent" : "bg-transparent group-hover:bg-border-strong",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-base font-medium">{meta.label}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {meta.person}
                  </span>
                </span>
                <span className="label shrink-0 text-faint">{meta.home}</span>
              </button>
            );
          })}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              signOut();
              setOpen(false);
              router.push("/");
            }}
            className="label flex min-h-14 w-full items-center border-t border-border px-6 text-left text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
