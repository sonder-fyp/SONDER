import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionProvider } from "@/lib/session";
import { MusicProvider } from "@/lib/music";

let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

import { AppShell } from "./AppShell";

function renderShell(children: string) {
  return render(
    <SessionProvider>
      <MusicProvider>
        <AppShell>
          <div>{children}</div>
        </AppShell>
      </MusicProvider>
    </SessionProvider>,
  );
}

describe("AppShell persistent chrome", () => {
  afterEach(() => {
    cleanup();
    pathname = "/";
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("shows landing slots on /", () => {
    renderShell("landing page");

    expect(document.querySelector("header.topbar")).toBeTruthy();
    expect(document.querySelector("header.topbar")?.className).toContain("fixed");
    expect(screen.getByRole("navigation", { name: "Landing" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Student" }).getAttribute("href")).toBe(
      "/student",
    );
    expect(screen.getByRole("link", { name: "Teacher" }).getAttribute("href")).toBe(
      "/teacher",
    );
    expect(screen.getByRole("link", { name: "Parent" }).getAttribute("href")).toBe(
      "/parent",
    );
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe(
      "/admin",
    );
    expect(screen.queryByText("Choose a workspace")).toBeNull();
    expect(screen.getByText("Skip to how it works")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play background music" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) theme/ }),
    ).toBeTruthy();
    expect(document.querySelector("header.topbar")?.className).not.toContain("border-accent");
  });

  it("keeps the same header node when crossing landing and product", () => {
    const { rerender } = renderShell("landing page");
    const header = document.querySelector("header.topbar");
    expect(header).toBeTruthy();

    pathname = "/student";
    rerender(
      <SessionProvider>
        <MusicProvider>
          <AppShell>
            <div>student page</div>
          </AppShell>
        </MusicProvider>
      </SessionProvider>,
    );

    expect(document.querySelector("header.topbar")).toBe(header);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
    expect(screen.getByText("Skip to content")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Landing" })).toBeNull();
    expect(screen.getByRole("button", { name: "Play background music" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) theme/ }),
    ).toBeTruthy();
    expect(document.querySelector("header.topbar")?.className).toContain("border-border");
    expect(document.querySelector("header.topbar")?.className).not.toContain("border-accent");
  });

  it("renders no chrome on the component gallery", () => {
    pathname = "/dev/components";
    renderShell("gallery");

    expect(document.querySelector("header.topbar")).toBeNull();
    expect(screen.queryByText("Skip to content")).toBeNull();
    expect(screen.getByText("gallery")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play background music" })).toBeNull();
  });

  it("keeps the consultant column shrinkable beside the sidebar", () => {
    pathname = "/student/consultant";
    renderShell("consultant");

    const main = document.getElementById("main") as HTMLElement;
    expect(main.className).toContain("min-w-0");
    expect(main.className).toContain("overflow-hidden");
    expect(main.parentElement?.className).toContain("min-w-0");
    expect(main.parentElement?.className).toContain("w-full");
  });
});
