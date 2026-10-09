"use client";

import dynamic from "next/dynamic";
import { useTheme } from "@/lib/theme";

const GenerativeArtScene = dynamic(
  () =>
    import("@/components/ui/anomalous-matter-hero").then(
      (m) => m.GenerativeArtScene,
    ),
  { ssr: false },
);

/** Neon is the dark ground's texture. On paper it reads as a green haze, so
 *  light mode swaps in the deep accent — the same #1b7a00 --accent resolves to,
 *  restated here because a WebGL uniform cannot read a CSS variable. */
const MATTER_COLOR = { dark: "#39FF14", light: "#1b7a00" } as const;

/**
 * Fixed wallpaper behind every route. Opacity keeps the field as ground, not
 * content, and comes from --matter-opacity so it is already correct at first
 * paint. pointer-events none, so it never intercepts the UI.
 */
export function BackgroundMatter() {
  const { theme } = useTheme();
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: "var(--matter-opacity)" }}
    >
      <GenerativeArtScene color={MATTER_COLOR[theme]} />
    </div>
  );
}
