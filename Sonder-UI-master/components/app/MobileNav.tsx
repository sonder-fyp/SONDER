"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/session";
import { NAV, isNavItemActive } from "@/lib/nav";
import { NavigationDrawer } from "./NavigationDrawer";

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const { account } = useSession();
  if (!account) return null;
  return (
    <NavigationDrawer open={open} onClose={onClose} title="Your workspace">
      <nav aria-label="Workspace navigation" className="space-y-8">
        {NAV[account.role].map((group, index) => (
          <div key={index}>
            {group.label ? (
              <p className="label mb-3 text-faint">{group.label}</p>
            ) : null}
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={
                  isNavItemActive(pathname, item, `/${account.role}`)
                    ? "page"
                    : undefined
                }
                className="flex min-h-14 items-center gap-4 border-b border-border text-base hover:text-accent aria-[current=page]:text-accent"
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </NavigationDrawer>
  );
}
