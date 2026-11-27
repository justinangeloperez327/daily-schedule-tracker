"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ClipboardCheck, FolderKanban, HardHat, LayoutDashboard, Menu, Truck, UserCog, X,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileMenu } from "@/components/profile-menu";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[]; adminOnly?: boolean };

const groups: NavGroup[] = [
  { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Operations",
    items: [
      { href: "/schedules", label: "Schedules", icon: CalendarDays },
      { href: "/site-reports", label: "Site Reports", icon: ClipboardCheck },
    ],
  },
  {
    label: "Master data",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/employees", label: "Employees", icon: HardHat },
      { href: "/equipments", label: "Equipments", icon: Truck },
    ],
  },
  { label: "Administration", adminOnly: true, items: [{ href: "/users", label: "Users", icon: UserCog }] },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white">
        <CalendarDays className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold tracking-[-0.03em] text-primary">Daily Schedule Tracker</span>
        <span className="technical-eyebrow block">Operations / Dispatch</span>
      </span>
    </Link>
  );
}

function SidebarNav({ user, pathname, onNavigate }: { user: AuthUser; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.filter((group) => !group.adminOnly || user.role === "admin").map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                      active
                        ? "bg-accent text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[#365F91]"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active ? "text-[#365F91]" : "")} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function pageTitle(pathname: string) {
  for (const group of groups) {
    for (const item of group.items) if (isActive(pathname, item.href)) return item.label;
  }
  if (pathname.startsWith("/profile")) return "Profile";
  return "";
}

export function AppShell({ user, children }: { user: AuthUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setDrawerOpen(false); menuButtonRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Signed-out pages (login) get a plain brand bar and no navigation.
  if (!user || pathname === "/login") {
    return (
      <>
        <header className="border-b border-border bg-white/95">
          <div className="flex h-14 items-center px-3 sm:h-16 sm:px-6 lg:px-8"><Brand /></div>
        </header>
        {children}
      </>
    );
  }

  return (
    <div className="flex min-h-screen min-w-0">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-border px-4"><Brand /></div>
        <SidebarNav user={user} pathname={pathname} />
        <p className="border-t border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Signed in as {user.username}
        </p>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" aria-label="Close navigation" className="absolute inset-0 bg-[#172b45]/30"
            onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between gap-2 border-b border-border px-4">
              <Brand />
              <button type="button" aria-label="Close navigation" autoFocus onClick={() => setDrawerOpen(false)}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarNav user={user} pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-white/95 px-3 backdrop-blur-sm sm:h-16 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>
            <p className="truncate text-sm font-semibold text-primary">{pageTitle(pathname)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            <ProfileMenu user={user} />
          </div>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
