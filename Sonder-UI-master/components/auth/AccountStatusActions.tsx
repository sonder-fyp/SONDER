"use client";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/lib/session";
import { Button, buttonVariants } from "@/components/ui/button";
export function AccountStatusActions() {
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-6">
        <Link href="/auth/continue" className={buttonVariants()}>
          Check access again
        </Link>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(false);
            try {
              await signOut();
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Signing out…" : "Sign out"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-attention">
          We could not sign you out. Please try again.
        </p>
      ) : null}
    </div>
  );
}
