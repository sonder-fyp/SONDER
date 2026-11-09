"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import type { AppRole } from "@/lib/auth/types";

type Props = {
  mode: "sign-in" | "sign-up";
  nextPath: string;
  verified?: boolean;
};

const PASSWORD_CHECKS = [
  (value: string) => value.length >= 8,
  (value: string) => /[a-z]/.test(value),
  (value: string) => /[A-Z]/.test(value),
  (value: string) => /\d/.test(value),
  (value: string) => /[^A-Za-z0-9]/.test(value),
];

const SOCIAL_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "apple", label: "Continue with Apple" },
  { id: "github", label: "Continue with GitHub" },
] as const;

const REGISTRATION_ROLES = [
  { value: "student", label: "Student" },
  { value: "teacher", label: "Teacher" },
  { value: "parent", label: "Parent or guardian" },
] as const satisfies readonly { value: Exclude<AppRole, "admin">; label: string }[];

function isRegistrationRole(value: string): value is (typeof REGISTRATION_ROLES)[number]["value"] {
  return REGISTRATION_ROLES.some((role) => role.value === value);
}

function onboardingPath(role: (typeof REGISTRATION_ROLES)[number]["value"]) {
  return `/auth/onboarding?requestedRole=${role}`;
}

function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/auth/continue";
  }
  try {
    const url = new URL(value, "https://sonder.invalid");
    if (url.origin !== "https://sonder.invalid") return "/auth/continue";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/auth/continue";
  }
}

export function AuthEntry({ mode, nextPath, verified = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registrationRole, setRegistrationRole] = useState<"student" | "teacher" | "parent">("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "sign-up";
  const checks = PASSWORD_CHECKS.filter((check) => check(password)).length;
  const passwordReady = password.length >= 8;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({
          email: email.trim().toLowerCase(),
          password,
          name: email.trim().toLowerCase(),
        });
        if (result.error) {
          setError("We couldn't create your account. Check your details, or sign in if you've already registered.");
          return;
        }
        router.replace(
          `/auth/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&requestedRole=${registrationRole}`,
        );
        return;
      }

      const result = await authClient.signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.error) {
        setError("Invalid email or password.");
        return;
      }
      if (result.data?.redirect) return;
      router.replace(safeNextPath(nextPath));
      router.refresh();
    } catch {
      setError(isSignUp
        ? "We couldn't create your account. Please check your details and try again."
        : "Invalid email or password.");
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider: (typeof SOCIAL_PROVIDERS)[number]["id"]) {
    setError(null);
    setBusy(true);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: `${window.location.origin}${isSignUp ? onboardingPath(registrationRole) : "/auth/continue"}`,
      });
      if (result.error) setError("That sign-in option is unavailable. Try email instead.");
    } catch {
      setError("That sign-in option is unavailable. Try email instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="w-full max-w-[480px]">
      <p className="label text-accent">Sonder account</p>
      <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
        {isSignUp ? "Create your account." : "Welcome back."}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        {isSignUp
          ? "Choose your account type now. Teacher and parent accounts need administrator approval."
          : "Sign in to continue to your Sonder workspace."}
      </p>

      {isSignUp ? (
        <div className="mt-6 grid gap-2">
          <label className="label" htmlFor="registration-role">I am registering as</label>
          <select
            id="registration-role"
            value={registrationRole}
            onChange={(event) => {
              if (isRegistrationRole(event.target.value)) setRegistrationRole(event.target.value);
            }}
            className="h-12 w-full border border-border-strong bg-input px-4 text-base text-foreground md:h-14"
          >
            {REGISTRATION_ROLES.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </select>
        </div>
      ) : null}

      {verified ? (
        <p className="mt-6 border-l-2 border-accent pl-4 text-sm" role="status">
          Your email is verified. Sign in to finish setting up your account.
        </p>
      ) : null}

      <div className="mt-8 grid gap-3">
        {SOCIAL_PROVIDERS.map((provider) => (
          <Button
            key={provider.id}
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void socialSignIn(provider.id)}
            className="w-full min-w-0 whitespace-normal px-3 text-center leading-snug"
          >
            {provider.label}
          </Button>
        ))}
      </div>

      <div className="my-8 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="label text-muted-foreground">or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-2">
          <label className="label" htmlFor={`${mode}-email`}>Email</label>
          <Input
            id={`${mode}-email`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <label className="label" htmlFor={`${mode}-password`}>Password</label>
            {!isSignUp ? (
              <Link
                href="/auth/forgot-password"
                className="min-h-11 py-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Forgot password?
              </Link>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Input
              id={`${mode}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="label min-h-11 shrink-0 px-3 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {isSignUp ? (
            <div className="mt-1" aria-live="polite">
              <div className="flex gap-1" aria-hidden="true">
                {PASSWORD_CHECKS.map((check, index) => (
                  <span
                    key={index}
                    className={`h-1 flex-1 ${check(password) ? "bg-accent" : "bg-border-strong"}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Password strength: {password.length === 0 ? "not entered" : checks < 2 ? "weak" : checks < 4 ? "fair" : "strong"}
                {password.length > 0 && !passwordReady ? " · use at least 8 characters" : ""}
              </p>
            </div>
          ) : null}
        </div>

        {error ? <p role="alert" className="text-sm text-attention">{error}</p> : null}

        <Button type="submit" size="lg" disabled={busy || (isSignUp && !passwordReady)}>
          {busy ? "Please wait…" : isSignUp ? "Create Account" : "Log In"}
        </Button>
      </form>

      <p className="mt-8 text-sm text-muted-foreground">
        {isSignUp ? "Already have an account? " : "New here? "}
        <Link
          href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
          className="text-foreground underline underline-offset-4"
        >
          {isSignUp ? "Log in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
