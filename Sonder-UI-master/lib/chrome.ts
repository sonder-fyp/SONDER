/**
 * Root-shell chrome. The header lives in AppShell and never remounts when
 * crossing landing and product routes; this helper only chooses which slots
 * and wrappers to show.
 */
export type ChromeMode = "gallery" | "landing" | "product" | "auth";

/** 1px sentinel in the landing page tree; TopBar observes it, never a scroll listener. */
export const LANDING_CHROME_SENTINEL_ID = "landing-chrome-sentinel";

export function chromeMode(pathname: string): ChromeMode {
  if (pathname.startsWith("/dev")) return "gallery";
  if (pathname === "/") return "landing";
  if (pathname === "/auth" || pathname.startsWith("/auth/")) return "auth";
  return "product";
}
