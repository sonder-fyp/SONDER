import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function LinkRow({
  href,
  title,
  description,
  className,
}: {
  href: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-16 items-baseline justify-between gap-6 border-b border-border py-5",
        "transition-colors duration-150 ease-[var(--ease)] hover:border-border-hover",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="relative inline-block text-lg font-medium tracking-normal">
          {title}
          <span
            aria-hidden
            className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-accent transition-transform duration-150 ease-[var(--ease)] group-hover:scale-x-100"
          />
        </span>
        {description ? (
          <span className="mt-2 block text-sm text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      <ArrowRight
        className="size-4 shrink-0 translate-x-0 text-muted-foreground transition-transform duration-150 ease-[var(--ease)] group-hover:translate-x-1 group-hover:text-accent"
        strokeWidth={1.5}
        aria-hidden
      />
    </Link>
  );
}
