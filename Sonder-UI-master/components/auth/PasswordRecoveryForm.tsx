"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function PasswordRecoveryForm({
  token,
  reset,
}: {
  token?: string;
  reset: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (reset) {
        if (!token) {
          setError("This reset link is invalid or has expired. Request a new one.");
          return;
        }
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) {
          setError("This reset link is invalid or has expired. Request a new one.");
          return;
        }
        router.replace("/auth/sign-in?reset=1");
        return;
      }

      const result = await authClient.requestPasswordReset({
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (result.error) {
        setError("We couldn't process that request. Please try again later.");
        return;
      }
      setSent(true);
    } catch {
      setError(reset
        ? "This reset link is invalid or has expired. Request a new one."
        : "We couldn't process that request. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  if (!reset && sent) {
    return (
      <section className="w-full max-w-[480px]">
        <p className="label text-accent">Password reset</p>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight">Check your inbox.</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground" role="status">
          If an account exists for that address, a password reset link will be sent.
        </p>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[480px]">
      <p className="label text-accent">Password reset</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight">
        {reset ? "Choose a new password." : "Forgot your password?"}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        {reset
          ? "Choose a new password for your Sonder account."
          : "Enter your email and we'll send a reset link if an account matches."}
      </p>
      <form className="mt-8 grid gap-5" onSubmit={(event) => void submit(event)}>
        {reset ? (
          <div className="grid gap-2">
            <label className="label" htmlFor="reset-password">New password</label>
            <div className="flex gap-2">
              <Input
                id="reset-password"
                type={visible ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
                className="label min-h-11 px-3 text-muted-foreground hover:text-foreground"
              >
                {visible ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <label className="label" htmlFor="reset-email">Email</label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}
        {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Please wait…" : reset ? "Set new password" : "Send reset link"}
        </Button>
      </form>
    </section>
  );
}
