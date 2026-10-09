"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { NAV, isNavItemActive, type NavItem } from "@/lib/nav";
import { useLocalFlag } from "@/lib/local-flag";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * The flush left column. Sticky under the top bar, its own hairline, no fill.
 * Hidden below lg, where MobileNav takes over.
 *
 * Collapse state persists in localStorage. Note that useLocalFlag's server
 * snapshot is always the fallback (expanded), so a collapsed nav expands for one
 * frame on first paint. That is the existing, accepted behaviour.
 */
export function WorkspaceNav() {
  const [collapsed, setCollapsed] = useLocalFlag("sonder.sidebar.collapsed");
  const { role } = useSession();
  if (!role) return null;

  const groups = NAV[role];
  const meta = ROLES[role];

  return (
    <div
      className={cn(
        "workspace-nav sticky top-[var(--topbar-h)] hidden shrink-0 flex-col",
        "h-[calc(100dvh-var(--topbar-h))] border-r border-border lg:flex",
        "transition-[width] duration-200 ease-[var(--ease)]",
        collapsed ? "w-[var(--nav-w-collapsed)]" : "w-[var(--nav-w)]",
      )}
    >
      {!collapsed ? (
        <p className="label shrink-0 px-6 pb-6 pt-8 text-muted-foreground">
          {meta.label} workspace
        </p>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="flex h-8 shrink-0 items-center justify-center pt-8 text-muted-foreground">
                <meta.icon className="size-[18px]" strokeWidth={1.5} aria-hidden />
                <span className="sr-only">{meta.label} workspace</span>
              </div>
            }
          />
          <TooltipContent side="right">{meta.label} workspace</TooltipContent>
        </Tooltip>
      )}

      <nav
        aria-label={`${meta.label} workspace`}
        className="app-scroll min-h-0 flex-1 overflow-y-auto pb-4"
      >
        {groups.map((group, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-6 border-t border-border pt-6")}>
            {group.label && !collapsed ? (
              <p className="label px-6 pb-3 text-muted-foreground">{group.label}</p>
            ) : null}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                collapsed={collapsed}
                home={meta.home}
              />
            ))}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand the workspace navigation" : "Collapse the workspace navigation"}
        className={cn(
          "label flex min-h-12 shrink-0 items-center gap-4 border-t border-border",
          "text-muted-foreground transition-colors duration-150 hover:text-foreground",
          collapsed ? "justify-center px-0" : "px-6",
        )}
      >
        {collapsed ? (
          <PanelLeft className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden />
        ) : (
          <>
            <PanelLeftClose className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden />
            <span>Collapse</span>
          </>
        )}
      </button>
    </div>
  );
}

function NavLink({
  item,
  collapsed,
  home,
}: {
  item: NavItem;
  collapsed: boolean;
  home: string;
}) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item, home);

  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-12 items-center gap-4 text-sm",
        "transition-colors duration-150 ease-[var(--ease)]",
        collapsed ? "justify-center px-0" : "px-6",
        active
          ? "font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 bg-accent" />
      ) : null}
      <Icon className="size-[18px] shrink-0" strokeWidth={1.5} aria-hidden />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** The flattened item list, for the mobile drawer. */
export { NavLink };
