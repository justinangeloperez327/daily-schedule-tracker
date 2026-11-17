"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  employeeName: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function EmployeeRowActions({ employeeName, onEdit, onDelete }: Props) {
  const trigger = React.useRef<HTMLButtonElement>(null);
  const menu = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  const reposition = React.useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 160;
    const menuHeight = 90;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    const top = window.innerHeight - rect.bottom < menuHeight + 12
      ? Math.max(8, rect.top - menuHeight - 6)
      : rect.bottom + 6;
    setPosition({ top, left });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    reposition();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  React.useEffect(() => {
    if (open && menu.current) {
      menu.current.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }
  }, [open, position]);

  function closeAndRun(callback: () => void) {
    setOpen(false);
    callback();
  }

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-7"
        title={"Actions for " + employeeName}
        aria-label={"Actions for " + employeeName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </Button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={"Actions for " + employeeName}
          style={{ position: "fixed", top: position.top, left: position.left, zIndex: 80, width: 160 }}
          className="rounded-lg border border-border bg-white p-1 shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const items = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              const shift = event.key === "ArrowDown" ? 1 : -1;
              items[(current + shift + items.length) % items.length]?.focus();
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-[#EAF3FF] focus-visible:bg-[#EAF3FF]"
            onClick={() => closeAndRun(onEdit)}
          >
            <Pencil aria-hidden="true" className="size-4" /> Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive outline-none hover:bg-red-50 focus-visible:bg-red-50"
            onClick={() => closeAndRun(onDelete)}
          >
            <Trash2 aria-hidden="true" className="size-4" /> Delete
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
