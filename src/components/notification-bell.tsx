"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Bell, ClipboardCheck, ClipboardX } from "lucide-react";
import { apiRequest } from "@/lib/http";
import type { AppNotification, NotificationKind } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { PopoverPanel, usePopover } from "@/components/ui/popover-menu";

type Feed = { items: AppNotification[]; unread: number };

const REFRESH_MS = 60_000;

const kindIcon: Record<NotificationKind, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  missing_report: { icon: ClipboardX, tone: "bg-amber-50 text-amber-700" },
  new_report: { icon: ClipboardCheck, tone: "bg-[#EAF2FC] text-[#365F91]" },
  wir_issue: { icon: AlertTriangle, tone: "bg-red-50 text-red-700" },
};

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + "h ago";
  return Math.round(hours / 24) + "d ago";
}

export function NotificationBell() {
  const pathname = usePathname();
  const { open, setOpen, triggerRef, panelRef } = usePopover();
  const [feed, setFeed] = React.useState<Feed>({ items: [], unread: 0 });
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  // Refresh on navigation (a report may have just been submitted) and every minute.
  React.useEffect(() => {
    let alive = true;
    const load = () => apiRequest<Feed>("/api/notifications")
      .then((result) => { if (alive) { setFeed(result); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoaded(true); });
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, [pathname]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && feed.items.some((item) => item.unread && item.kind !== "missing_report")) {
      // Keep the highlighted rows visible while the panel is open; only the badge clears.
      await apiRequest("/api/notifications/seen", { method: "POST" }).catch(() => null);
      setFeed((current) => ({
        ...current,
        unread: current.items.filter((item) => item.kind === "missing_report").length,
      }));
    }
  }

  const badge = feed.unread > 9 ? "9+" : String(feed.unread);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={feed.unread ? "Notifications, " + feed.unread + " unread" : "Notifications"}
        title="Notifications"
        className="relative inline-flex size-10 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Bell className="size-[18px]" aria-hidden="true" />
        {feed.unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 font-mono text-[10px] font-semibold text-white ring-2 ring-white">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <PopoverPanel panelRef={panelRef} role="dialog" aria-label="Notifications"
          className="fixed inset-x-3 top-[60px] mt-0 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[380px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-primary">Notifications</p>
            <span className="text-xs text-muted-foreground">{feed.items.length} total</span>
          </div>
          <div className="max-h-[min(440px,70vh)] overflow-y-auto overscroll-contain">
            {!loaded ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading...</p>
            ) : failed ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Couldn&apos;t load notifications. Try again in a moment.</p>
            ) : feed.items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-muted-foreground">Missing site reports, new reports and WIR issues appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {feed.items.map((item) => {
                  const { icon: Icon, tone } = kindIcon[item.kind];
                  return (
                    <li key={item.id}>
                      <Link href={item.href} onClick={() => setOpen(false)}
                        className={cn("flex gap-3 px-4 py-3 hover:bg-[var(--table-hover)] focus-visible:bg-[var(--table-focus)] focus-visible:outline-none",
                          item.unread && "bg-[#F7FAFE]")}>
                        <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md", tone)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className={cn("text-sm leading-5", item.unread ? "font-semibold text-foreground" : "font-medium text-foreground")}>
                              {item.title}
                            </span>
                            {item.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#365F91]" aria-label="Unread" />}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.body}</span>
                          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{timeAgo(item.at)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}
