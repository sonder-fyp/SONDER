import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Text-first buttons. There are no filled buttons in this build.
 *
 * The underline is a ::after pseudo-element, NOT a child <span>. That is
 * deliberate: `buttonVariants()` is applied as a className to <Link> in about
 * fifteen places, and a pseudo-element travels with the class string while a
 * child element would not. Do not "improve" this into a span.
 */
const buttonVariants = cva(
  [
    "group relative inline-flex shrink-0 items-center justify-center",
    "whitespace-nowrap font-semibold uppercase",
    "transition-all duration-150 ease-[var(--ease)]",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        /* Primary: accent text over a 2px accent rule that widens on hover.
           Tracking is narrower than .label's 0.2em: a primary action must
           out-rank the captions around it, not match them. */
        primary: [
          "px-0 tracking-wide text-accent",
          "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0",
          "after:h-0.5 after:bg-accent after:origin-center after:scale-x-100",
          "after:transition-transform after:duration-150 after:ease-[var(--ease)]",
          "hover:after:scale-x-110",
        ].join(" "),

        /* Secondary: 1px outline that fully inverts on hover. */
        outline: [
          "border border-foreground px-6 tracking-wider text-foreground",
          "hover:bg-foreground hover:text-background",
        ].join(" "),

        /* Ghost: muted text, hairline underline drawn in from the left on hover. */
        ghost: [
          "px-4 tracking-wider text-muted-foreground hover:text-foreground",
          "after:pointer-events-none after:absolute after:inset-x-4 after:bottom-0",
          "after:h-px after:bg-current after:origin-left after:scale-x-0",
          "after:transition-transform after:duration-150 after:ease-[var(--ease)]",
          "hover:after:scale-x-100",
        ].join(" "),
      },
      size: {
        sm: "min-h-11 gap-2 py-3 text-xs",
        default: "min-h-11 gap-2.5 py-3 text-sm",
        lg: "min-h-14 gap-3 py-4 text-base",
        /* Icon buttons carry no underline and must always have an aria-label. */
        icon: "size-11 gap-0 px-0 after:hidden",
      },
    },
    compoundVariants: [
      /* Primary out-ranks the .label captions around it: one step up from the
         shared size scale. Outline and ghost are unchanged. */
      { variant: "primary", size: "default", class: "text-base" },
      { variant: "primary", size: "lg", class: "text-lg" },
    ],
    defaultVariants: { variant: "primary", size: "default" },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
