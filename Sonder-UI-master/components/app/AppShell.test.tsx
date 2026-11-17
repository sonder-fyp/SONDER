import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const state = vi.hoisted(() => ({
  path: "/",
  loading: false,
  email: null as string | null,
  account: null as null | { role: "student"; display_name: string },
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.path,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/session", () => ({
  useSession: () => ({
    account: state.account,
    email: state.email,
    loading: state.loading,
    signOut: vi.fn(),
  }),
}));
import { AppShell } from "./AppShell";
describe("product navigation", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  });
  afterEach(() => {
    cleanup();
    state.path = "/";
    state.email = null;
    state.loading = false;
    state.account = null;
    localStorage.clear();
  });
  it("offers product information and account entry without role entrances", () => {
    render(<AppShell>Landing</AppShell>);
    expect(
      screen.getByRole("navigation", { name: "Public website" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Create account" }).getAttribute("href"),
    ).toBe("/auth/sign-up");
    for (const name of ["Student", "Teacher", "Parent", "Admin"])
      expect(screen.queryByRole("link", { name })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Play background music" }),
    ).toBeNull();
  });
  it("keeps account entry actionable while the session refreshes", () => {
    state.loading = true;
    render(<AppShell>Landing</AppShell>);
    expect(
      screen
        .getByRole("link", { name: "Continue" })
        .getAttribute("href"),
    ).toBe("/auth/continue");
    expect(screen.queryByText("Loading account…")).toBeNull();
  });
  it("offers returning accounts their own dashboard instead of registration", () => {
    state.account = { role: "student", display_name: "Test Student" };
    render(<AppShell>Landing</AppShell>);
    expect(
      screen.getByRole("link", { name: "Open dashboard" }).getAttribute("href"),
    ).toBe("/auth/continue");
    expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
  });
  it("routes an account awaiting onboarding back to account setup", () => {
    state.email = "student@sonder.invalid";
    render(<AppShell>Landing</AppShell>);
    expect(
      screen.getByRole("link", { name: "Continue setup" }).getAttribute("href"),
    ).toBe("/auth/continue");
    expect(screen.queryByRole("link", { name: "Open dashboard" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
  });
  it("opens and closes the product mobile navigation without resetting it during render", () => {
    state.path = "/student";
    state.account = { role: "student", display_name: "Test Student" };
    render(<AppShell>Student</AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog", { name: "Your workspace" })).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });
  it("closes the public menu on selection", () => {
    render(<AppShell>Landing</AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const nav = screen.getByRole("navigation", {
      name: "Public mobile navigation",
    });
    fireEvent.click(nav.querySelector('a[href="#educators"]')!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps identifiers out of the breadcrumb", () => {
    state.path = "/teacher/session/11111111-1111-4111-8111-111111111111";
    render(<AppShell>Evidence</AppShell>);
    const crumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(crumb.textContent).toContain("Details");
    expect(crumb.textContent).not.toContain("11111111");
    expect(crumb.querySelector('a[href="/teacher/session"]')).toBeNull();
  });
});
