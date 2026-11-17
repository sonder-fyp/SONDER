"use client";

import { usePathname } from "next/navigation";
import { chromeMode } from "@/lib/chrome";
import { TopBar } from "./TopBar";
import { WorkspaceNav } from "./WorkspaceNav";

/**
 * Persistent chrome. The document is the scroll container except on consultant
 * routes, where ChatFrame owns an inner scroller and main is overflow-hidden
 * so the page itself does not scroll.
 *
 * The header is always mounted on landing and product so crossing `/` and a
 * role home only swaps slots.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mode = chromeMode(pathname);

  // The dev component gallery carries no product chrome.
  if (mode === "gallery") {
    return (
      <div className="relative z-[1] min-h-dvh bg-transparent">{children}</div>
    );
  }

  if (mode === "auth") {
    return (
      <div className="product-surface relative z-[1] min-h-dvh bg-transparent">
        {children}
      </div>
    );
  }

  return (
    <div
      className={`${mode === "landing" ? "" : "product-surface "}relative z-[1] min-h-dvh bg-transparent`}
    >
      <a
        href={mode === "landing" ? "#narrative" : "#main"}
        className="skip-link"
      >
        {mode === "landing" ? "Skip to how it works" : "Skip to content"}
      </a>

      <TopBar />

      {mode === "landing" ? (
        children
      ) : (
        <div className="flex min-w-0 w-full">
          <WorkspaceNav />
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-16">
            {children}
          </main>
        </div>
      )}
    </div>
  );
}
