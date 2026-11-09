"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function VerifyEmailForm({
  initialEmail,
  requestedRole,
}: {
  initialEmail: string;
  requestedRole: "student" | "teacher" | "parent";
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: email.trim().toLowerCase(),
        otp: code.trim(),
      });
      if (result.error) {
        setError("That code is invalid or has expired. Request a new code and try again.");
        return;
      }
      const next = `/auth/onboarding?requestedRole=${requestedRole}`;
      router.replace(`/auth/sign-in?verified=1&next=${encodeURIComponent(next)}`);
    } catch {
      setError("That code is invalid or has expired. Request a new code and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: "email-verification",
      });
      if (result.error) {
        setError("We couldn't send another code right now. Please try again later.");
      } else {
        setMessage("If this address has a pending account, a new code has been sent.");
      }
    } catch {
      setError("We couldn't send another code right now. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-[480px]">
      <p className="label text-accent">Email verification</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Check your inbox.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Enter the one-time code we sent to your email address.
      </p>
      <form className="mt-8 grid gap-5" onSubmit={(event) => void verify(event)}>
        <div className="grid gap-2">
          <label className="label" htmlFor="verification-email">Email</label>
          <Input
            id="verification-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <label className="label" htmlFor="verification-code">One-time code</label>
          <Input
            id="verification-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={12}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
        <Button type="submit" size="lg" disabled={busy}>Verify email</Button>
      </form>
      <button
        type="button"
        disabled={busy}
        onClick={() => void resend()}
        className="label mt-5 min-h-11 text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
      >
        Send a new code
      </button>
    </section>
  );
}
