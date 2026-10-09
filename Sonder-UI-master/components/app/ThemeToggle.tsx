"use client";

import { useId, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import {
  useTheme,
  applyTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  type Theme,
} from "@/lib/theme";

const LABEL: Record<Theme, string> = {
  dark: "Switch to light theme",
  light: "Switch to dark theme",
};

/**
 * The theme switch. Shows the theme you would move TO: a sun while dark, a moon
 * while light. One SVG does both — a disc masked by a circle that slides across
 * to carve a crescent, and eight rays that retract. Every transition is CSS,
 * driven off [data-theme] on <html>, so the mark stays correct in browsers with
 * no View Transition support and needs no JS to stay in sync.
 *
 * The click hands the button's centre to the store, which expands the page-wide
 * circular wipe from that point.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  // useId can emit characters that are illegal in a fragment identifier.
  const maskId = `tk-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  // React's Strict Mode remount in development resets <html> to only the
  // attributes it manages from JSX, clearing the one the inline script set.
  // Re-apply before paint. A no-op in production. This is the fix the Next.js
  // guide prescribes; see its "Re-applying attributes in development" section.
  useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    applyTheme(stored === "light" || stored === "dark" ? stored : DEFAULT_THEME);
  }, []);

  return (
    <button
      type="button"
      data-theme-state={theme}
      aria-label={LABEL[theme]}
      title={LABEL[theme]}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      }}
      className={cn(
        "theme-toggle grid size-11 shrink-0 place-items-center",
        "text-muted-foreground transition-colors duration-150 hover:text-accent",
        className,
      )}
    >
      <svg
        className="theme-toggle-mark"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        aria-hidden
        focusable="false"
      >
        {/* maskUnits/maskContentUnits are set explicitly: the default
            objectBoundingBox units are computed from the masked element's bbox
            and would clip the crescent. */}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          maskContentUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="24"
          height="24"
        >
          <rect x="0" y="0" width="24" height="24" fill="#fff" />
          {/* Parked clear of the disc while dark (centre 16.3 units away, r=8,
              disc outer radius 7.25). Slides onto it to carve the moon. */}
          <circle className="tk-bite" cx="26" cy="-2" r="8" fill="#000" />
        </mask>

        <g
          className="tk-rays"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
          <line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
          <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
          <line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
        </g>

        <circle
          className="tk-disc"
          cx="12"
          cy="12"
          r="6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          mask={`url(#${maskId})`}
        />
      </svg>
    </button>
  );
}
