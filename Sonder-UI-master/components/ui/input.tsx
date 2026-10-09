import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // text-base (16px) is load-bearing: anything smaller makes iOS Safari
        // zoom the viewport on focus. Do not drop it to text-sm.
        "h-12 w-full min-w-0 border border-border-strong bg-input px-4",
        "text-base text-foreground placeholder:text-muted-foreground",
        "transition-colors duration-150 ease-[var(--ease)]",
        "focus:border-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "md:h-14",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
