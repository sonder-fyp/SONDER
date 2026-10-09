import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app/AppShell";
import { InlineScript } from "@/components/app/InlineScript";
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "@/lib/theme";

/** Primary. Headlines and body both. Inter Tight ships tighter default sidebearings
 *  than Inter, which is what lets display sizes sit at -0.06em without collapsing. */
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Labels, stats, codes, dates. Never prose. */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/** Pull quotes only. Four permitted call sites in the whole build. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sonder: Beyond Right or Wrong",
    template: "%s · Sonder",
  },
  description:
    "Sonder diagnoses the specific misconception behind a wrong answer, shows a teacher its evidence, and never reaches a student or parent unreviewed. Interactive proof of concept.",
  openGraph: {
    title: "Sonder: Beyond Right or Wrong",
    description:
      "Adaptive misconception diagnosis across Maths, Physics and Chemistry. Every result passes a teacher first.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${interTight.variable} ${jetbrainsMono.variable} ${playfair.variable}`}
    >
      <head>
        <InlineScript
          html={`(function(){try{var t=localStorage.getItem(${JSON.stringify(
            THEME_STORAGE_KEY,
          )});if(t==="light"||t==="dark")document.documentElement.setAttribute(${JSON.stringify(
            THEME_ATTRIBUTE,
          )},t)}catch(e){}})()`}
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
