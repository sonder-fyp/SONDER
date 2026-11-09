"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function OnboardingForm({
  requestedRole,
}: {
  requestedRole: "student" | "teacher" | "parent";
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, requestedRole }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "We couldn't save your details.");
        return;
      }
      router.replace("/auth/continue");
      router.refresh();
    } catch {
      setError("We couldn't save your details. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-[480px]">
      <p className="label text-accent">A little about you</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Welcome to Sonder.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        {requestedRole === "student"
          ? "Your student workspace will be ready when you finish."
          : `Your ${requestedRole} registration will be sent to an administrator for approval.`}
      </p>
      <form className="mt-8 grid gap-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-2">
          <label className="label" htmlFor="display-name">Name</label>
          <Input
            id="display-name"
            autoComplete="name"
            maxLength={80}
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Account type: <span className="text-foreground">{requestedRole}</span>
        </p>
        {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Saving…" : "Continue"}
        </Button>
      </form>
    </section>
  );
}
