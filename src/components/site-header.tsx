"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/schedules", label: "Schedules" },
  { href: "/projects", label: "Projects" },
  { href: "/employees", label: "Employees" },
  { href: "/equipments", label: "Equipments" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-8 gap-y-2 px-5 sm:px-8 lg:px-10">
        <Link href="/schedules" className="flex h-16 shrink-0 items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#20262e] text-white">
            <CalendarDays className="size-[18px]" />
          </span>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            Daily Schedule Tracker
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex h-12 flex-1 items-center gap-1 overflow-x-auto sm:h-16">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#f1f3f5] text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
