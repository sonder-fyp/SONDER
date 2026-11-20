import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

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
    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue with Apple" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue with GitHub" }),
    ).toBeNull();
  });

  it("creates an account and sends the user to email verification", async () => {
    mocks.signUp.email.mockResolvedValue({ data: {}, error: null });
    render(<AuthEntry mode="sign-up" nextPath="/auth/onboarding" />);
    fireEvent.change(screen.getByLabelText("I am registering as"), {
      target: { value: "teacher" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "Ahmed@Example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "LongEnough8!" },
    });
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

  it("suggests signing in when email registration cannot create another account", async () => {
    mocks.signUp.email.mockResolvedValue({
      data: null,
      error: new Error("User already exists"),
    });
    render(<AuthEntry mode="sign-up" nextPath="/auth/onboarding" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ahmed@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "LongEnough8!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We couldn't create your account. Check your details, or sign in if you've already registered.",
    );
  });

  it("uses a generic login error and does not expose account existence", async () => {
    mocks.signIn.email.mockResolvedValue({
      data: null,
      error: new Error("email not found"),
    });
    render(<AuthEntry mode="sign-in" nextPath="/auth/continue" />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ahmed@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Invalid email or password.",
    );
  });
  it("explains a rejected origin instead of blaming the user's details", async () => {
    const originError = { code: "INVALID_ORIGIN", message: "Invalid origin", status: 403, statusText: "Forbidden" };
    for (const mode of ["sign-up", "sign-in"] as const) {
      mocks.signUp.email.mockResolvedValue({ data: null, error: originError });
      mocks.signIn.email.mockResolvedValue({ data: null, error: originError });
      const view = render(<AuthEntry mode={mode} nextPath="/auth/continue" />);
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ahmed@example.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "LongEnough8!" } });
      fireEvent.click(screen.getByRole("button", { name: mode === "sign-up" ? "Create Account" : "Log In" }));
      const text = (await screen.findByRole("alert")).textContent ?? "";
      expect(text).toContain("This address isn't allowed to sign in yet. Open Sonder from its usual address and try again.");
      expect(text).toContain("http://localhost:3000");
      view.unmount();
    }
  });
  it("returns to a valid task after login and rejects external return URLs", async () => {
    mocks.signIn.email.mockResolvedValue({ data: {}, error: null });
    for (const [nextPath, expected] of [
      [
        "/student/diagnostic/U1?session=example",
        "/student/diagnostic/U1?session=example",
      ],
      ["//external.invalid", "/auth/continue"],
      ["https://external.invalid", "/auth/continue"],
    ]) {
      const view = render(<AuthEntry mode="sign-in" nextPath={nextPath} />);
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "student@sonder.invalid" },
      });
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "LongEnough8!" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Log In" }));
      await waitFor(() =>
        expect(mocks.replace).toHaveBeenLastCalledWith(expected),
      );
      view.unmount();
    }
  });

  describe("errors thrown by the Neon client", () => {
    const neonError = (status: number, message: string, code?: string) =>
      Object.assign(new Error(message), {
        status,
        statusText: "x",
        error: { code, message, status },
      });

    async function submitMode(mode: "sign-up" | "sign-in") {
      render(<AuthEntry mode={mode} nextPath="/auth/continue" />);
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ahmed@example.com" } });
      fireEvent.change(screen.getByLabelText("Password"), { target: { value: "LongEnough8!" } });
      fireEvent.click(screen.getByRole("button", { name: mode === "sign-up" ? "Create Account" : "Log In" }));
      return (await screen.findByRole("alert")).textContent ?? "";
    }

    it("explains a rejected origin on sign-up", async () => {
      mocks.signUp.email.mockRejectedValue(neonError(403, "Invalid origin", "INVALID_ORIGIN"));
      expect(await submitMode("sign-up")).toContain("This address isn't allowed to sign in yet.");
    });

    it("explains a rejected origin on sign-in", async () => {
      mocks.signIn.email.mockRejectedValue(neonError(403, "Invalid origin", "INVALID_ORIGIN"));
      expect(await submitMode("sign-in")).toContain("This address isn't allowed to sign in yet.");
    });

    it("says the email is already registered on sign-up", async () => {
      mocks.signUp.email.mockRejectedValue(
        neonError(422, "User already exists. Use another email.", "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"),
      );
      expect(await submitMode("sign-up")).toBe(
        "This email is already registered. Sign in instead, or use a different email.",
      );
    });

    it("keeps the generic message for other thrown sign-up failures", async () => {
      mocks.signUp.email.mockRejectedValue(neonError(500, "HTTP 500 Internal Server Error"));
      expect(await submitMode("sign-up")).toBe(
        "We couldn't create your account. Please check your details and try again.",
      );
    });
  });
});
