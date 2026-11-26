"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LogOut, Menu, X } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/schedules", label: "Schedules" },
  { href: "/site-reports", label: "Site Reports" },
  { href: "/projects", label: "Projects" },
  { href: "/trackers", label: "Trackers" },
  { href: "/employees", label: "Employees" },
  { href: "/equipments", label: "Equipments" },
];

export function SiteHeader({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const signedIn = !!user && pathname !== "/login";
  const visibleLinks = user?.role === "admin" ? [...links, { href: "/users", label: "Users" }] : links;

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    // Full reload on purpose so the server-rendered header drops the signed-in state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  const account = (isMobile: boolean) => (
    <div className={cn("flex items-center gap-2", isMobile ? "mt-2 justify-between border-t border-border pt-3" : "ml-2 border-l border-border pl-3")}>
      <span className="min-w-0 text-right leading-tight">
        <span className="block truncate text-sm font-medium text-foreground">{user?.name}</span>
        <span className="block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{user?.role}</span>
      </span>
      <button
        type="button"
        onClick={signOut}
        disabled={signingOut}
        title="Sign out"
        aria-label="Sign out"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
      >
        <LogOut aria-hidden="true" className="size-4" />
      </button>
    </div>
  );

  const navigation = (isMobile: boolean) => visibleLinks.map((link) => {
    const active = pathname === link.href || pathname.startsWith(link.href + "/");
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex items-center rounded-md px-3 text-sm font-medium transition-colors",
          isMobile ? "min-h-11 w-full" : "h-9 shrink-0",
          active
            ? "bg-accent text-primary shadow-[inset_0_-2px_0_#365F91]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {link.label}
      </Link>
    );
  });

  return (
    <header className="relative z-40 border-b border-border bg-white/95">
      <div className="flex w-full min-w-0 items-center justify-between gap-3 px-3 sm:px-6 lg:px-8 2xl:px-10">
        <Link href="/schedules" className="flex h-14 min-w-0 shrink items-center gap-2.5 sm:h-16 sm:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <CalendarDays className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[-0.03em] text-primary sm:text-base">
              Daily Schedule Tracker
            </span>
            <span className="technical-eyebrow hidden sm:block">Operations / Dispatch</span>
          </span>
        </Link>
        {signedIn && (
          <nav aria-label="Main navigation" className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1 md:flex">
            {navigation(false)}
            {account(false)}
          </nav>
        )}
        {signedIn && <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:hidden"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-main-navigation"
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>}
      </div>
      {signedIn && <nav
        id="mobile-main-navigation"
        aria-label="Mobile navigation"
        className={cn("border-t border-border px-3 py-2 sm:px-6 md:hidden", !mobileOpen && "hidden")}
      >
        <div className="grid gap-1">{navigation(true)}</div>
        {account(true)}
      </nav>}
    </header>
  );
}
