import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content min-h-28 w-full border border-border-strong bg-input px-4 py-3",
        "text-base leading-normal text-foreground placeholder:text-muted-foreground",
        "transition-colors duration-150 ease-[var(--ease)]",
        "focus:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
