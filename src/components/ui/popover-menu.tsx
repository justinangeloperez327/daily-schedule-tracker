"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// Small anchored dropdown: closes on outside click or Escape and returns focus to the trigger.
export function usePopover() {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, triggerRef, panelRef };
}

export function PopoverPanel({ panelRef, className, children, ...props }:
  React.ComponentProps<"div"> & { panelRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-white shadow-[0_12px_32px_rgba(16,24,40,0.12)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
