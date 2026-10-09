"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { Check, AlertTriangle, Minus } from "lucide-react";
import { useTheme } from "@/lib/theme";

/**
 * Icons follow the plan's four status buckets: confirmed, attention, inert.
 * There is no error/red state anywhere in this build, so `error` reuses the
 * attention glyph. The surface colours come from our own tokens in the style
 * block below; `theme` only selects Sonner's internal defaults underneath them,
 * which is why it has to follow ours.
 */
const Toaster = (props: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: <Check className="size-4" strokeWidth={1.5} />,
        info: <Minus className="size-4" strokeWidth={1.5} />,
        warning: <AlertTriangle className="size-4" strokeWidth={1.5} />,
        error: <AlertTriangle className="size-4" strokeWidth={1.5} />,
        loading: <Minus className="size-4" strokeWidth={1.5} />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border-strong)",
          "--border-radius": "0px",
          "--font-family": "var(--stack-sans)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast" } }}
      {...props}
    />
  );
};

export { Toaster };
