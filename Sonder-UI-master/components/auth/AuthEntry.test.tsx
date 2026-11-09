import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: mocks.signIn,
    signUp: mocks.signUp,
  },
}));

import { AuthEntry } from "./AuthEntry";

describe("authentication entry forms", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("offers a minimal sign-up form with password visibility and strength feedback", () => {
    render(<AuthEntry mode="sign-up" nextPath="/auth/onboarding" />);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByLabelText("I am registering as")).toBeTruthy();
    expect(screen.queryByLabelText(/confirm password/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    expect(screen.getByText(/Password strength:/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with Apple" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue with GitHub" })).toBeTruthy();
  });

  it("creates an account and sends the user to email verification", async () => {
    mocks.signUp.email.mockResolvedValue({ data: {}, error: null });
    render(<AuthEntry mode="sign-up" nextPath="/auth/onboarding" />);
    fireEvent.change(screen.getByLabelText("I am registering as"), { target: { value: "teacher" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "Ahmed@Example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "LongEnough8!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mocks.signUp.email).toHaveBeenCalledWith({
        email: "ahmed@example.com",
        password: "LongEnough8!",
        name: "ahmed@example.com",
      });
      expect(mocks.replace).toHaveBeenCalledWith(
        "/auth/verify-email?email=ahmed%40example.com&requestedRole=teacher",
      );
    });
  });

  it("keeps the selected account type through social registration", async () => {
    mocks.signIn.social.mockResolvedValue({ data: {}, error: null });
    render(<AuthEntry mode="sign-up" nextPath="/auth/onboarding" />);
    fireEvent.change(screen.getByLabelText("I am registering as"), { target: { value: "parent" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mocks.signIn.social).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: `${window.location.origin}/auth/onboarding?requestedRole=parent`,
      });
    });
  });

  it("suggests signing in when email registration cannot create another account", async () => {
    mocks.signUp.email.mockResolvedValue({
      data: null,
      error: new Error("User already exists"),
    });
    render(<AuthEntry mode="sign-up" nextPath="/auth/onboarding" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ahmed@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "LongEnough8!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn't create your account. Check your details, or sign in if you've already registered.",
    );
  });

  it("uses a generic login error and does not expose account existence", async () => {
    mocks.signIn.email.mockResolvedValue({ data: null, error: new Error("email not found") });
    render(<AuthEntry mode="sign-in" nextPath="/auth/continue" />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ahmed@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "incorrect-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Invalid email or password.");
  });
});
