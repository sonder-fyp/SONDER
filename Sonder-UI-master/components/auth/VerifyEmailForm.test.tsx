import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  emailOtp: { verifyEmail: vi.fn(), sendVerificationOtp: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { emailOtp: mocks.emailOtp },
}));

import { VerifyEmailForm } from "./VerifyEmailForm";

function setup() {
  return render(<VerifyEmailForm initialEmail=" Student@Example.com " requestedRole="teacher" />);
}

describe("VerifyEmailForm", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the address as text and offers no email field", () => {
    const { container } = setup();
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByText("student@example.com")).toBeTruthy();
  });

  it("verifies the fixed address with the trimmed code and goes to sign-in", async () => {
    mocks.emailOtp.verifyEmail.mockResolvedValue({ error: null });
    setup();
    fireEvent.change(screen.getByLabelText("One-time code"), { target: { value: " 123456 " } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    expect(mocks.emailOtp.verifyEmail).toHaveBeenCalledWith({
      email: "student@example.com",
      otp: "123456",
    });
    const next = encodeURIComponent("/auth/onboarding?requestedRole=teacher");
    expect(mocks.replace).toHaveBeenCalledWith(`/auth/sign-in?verified=1&next=${next}`);
  });

  it("sends a new code to the fixed address", async () => {
    mocks.emailOtp.sendVerificationOtp.mockResolvedValue({ error: null });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    await waitFor(() =>
      expect(mocks.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({
        email: "student@example.com",
        type: "email-verification",
      }),
    );
  });

  it("links back to sign-up for a wrong address", () => {
    setup();
    const link = screen.getByRole("link", { name: "Wrong address? Start over" });
    expect(link.getAttribute("href")).toBe("/auth/sign-up");
  });

  it("shows the existing error for an invalid code", async () => {
    mocks.emailOtp.verifyEmail.mockResolvedValue({ error: { message: "bad" } });
    setup();
    fireEvent.change(screen.getByLabelText("One-time code"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("That code is invalid or has expired. Request a new code and try again.");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
