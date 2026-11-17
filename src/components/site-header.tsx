"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/schedules", label: "Schedules" },
  { href: "/projects", label: "Projects" },
  { href: "/employees", label: "Employees" },
  { href: "/equipments", label: "Equipments" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const navigation = (isMobile: boolean) => links.map((link) => {
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
            ? "bg-[#f1f3f5] text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {link.label}
      </Link>
    );
  });

  return (
    <header className="relative z-40 border-b border-border bg-white">
      <div className="flex w-full min-w-0 items-center justify-between gap-3 px-3 sm:px-6 lg:px-8 2xl:px-10">
        <Link href="/schedules" className="flex h-14 min-w-0 shrink items-center gap-2.5 sm:h-16 sm:gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#20262e] text-white">
            <CalendarDays className="size-[18px]" />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
            Daily Schedule Tracker
          </span>
        </Link>
        <nav aria-label="Main navigation" className="hidden min-w-0 flex-1 flex-wrap items-center justify-end gap-1 md:flex">
          {navigation(false)}
        </nav>
        <button
          type="button"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-input text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:hidden"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-main-navigation"
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
        </button>
      </div>
      <nav
        id="mobile-main-navigation"
        aria-label="Mobile navigation"
        className={cn("border-t border-border px-3 py-2 sm:px-6 md:hidden", !mobileOpen && "hidden")}
      >
        <div className="grid gap-1">{navigation(true)}</div>
      </nav>
    </header>
  );
}
