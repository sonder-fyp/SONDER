"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

export function RoleMenu() {
  const { account, email, loading, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const current = account ? ROLES[account.role] : null;
  if (loading) return <span className="label text-muted-foreground">Account</span>;
  if (!account) {
    return (
      <Link
        href="/auth/sign-in"
        className="label flex min-h-11 items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        Log in
      </Link>
    );
  }

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
                {email}
              </span>
            </>
          ) : (
            "Account"
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
              <p className="mt-3 max-w-[28ch] truncate text-lg font-medium leading-snug">{email}</p>
              <p className="mt-1 text-sm text-muted-foreground">{account.display_name}</p>
            </div>
          ) : null}

          <Link
            href={ROLES[account.role].home}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={cn("label flex min-h-14 w-full items-center px-6 text-muted-foreground", "hover:bg-muted hover:text-foreground")}
          >
            Open {current?.label.toLowerCase()} workspace
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setError(null);
              try {
                await signOut();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Unable to sign out.");
              }
            }}
            className="label flex min-h-14 w-full items-center border-t border-border px-6 text-left text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Sign out
          </button>
          {error ? <p role="alert" className="px-6 pb-4 text-sm text-attention">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
