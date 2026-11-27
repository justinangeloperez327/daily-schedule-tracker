"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserCog, UserRound } from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { PopoverPanel, usePopover } from "@/components/ui/popover-menu";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const itemClass = "flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50";

export function ProfileMenu({ user }: { user: AuthUser }) {
  const { open, setOpen, triggerRef, panelRef } = usePopover();
  const [signingOut, setSigningOut] = React.useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    // Full reload on purpose so the server-rendered shell drops the signed-in state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={"Account menu for " + user.name}
        className="flex h-10 items-center gap-2 rounded-md border border-transparent pl-1 pr-2 hover:border-border hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[140px] truncate text-sm font-medium text-foreground">{user.name}</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{user.role}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </button>
      {open && (
        <PopoverPanel panelRef={panelRef} role="menu" aria-label="Account" className="w-60 p-1.5">
          <div className="mb-1 border-b border-border px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold text-primary">{user.name}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">@{user.username}</p>
          </div>
          <Link href="/profile" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
            <UserRound className="size-4 text-muted-foreground" aria-hidden="true" /> Profile
          </Link>
          {user.role === "admin" && (
            <Link href="/users" role="menuitem" className={itemClass} onClick={() => setOpen(false)}>
              <UserCog className="size-4 text-muted-foreground" aria-hidden="true" /> Manage users
            </Link>
          )}
          <div className="my-1 border-t border-border" />
          <button type="button" role="menuitem" className={itemClass + " text-destructive hover:text-destructive"}
            onClick={signOut} disabled={signingOut}>
            <LogOut className="size-4" aria-hidden="true" /> {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </PopoverPanel>
      )}
    </div>
  );
}
