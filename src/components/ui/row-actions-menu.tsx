"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { Copy, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RowActionsMenuProps = {
  itemName: string;
  onEdit?: () => void;
  onDelete: () => void;
  viewHref?: string;
  viewLabel?: string;
  onDuplicate?: () => void;
  deleteLabel?: string;
  disabled?: boolean;
};

export function RowActionsMenu({
  itemName, onEdit, onDelete, viewHref, viewLabel = "View details",
  onDuplicate, deleteLabel = "Delete", disabled = false,
}: RowActionsMenuProps) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ top: 0, left: 0 });

  const reposition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 164;
    const height = 12 + 38 * (Number(!!viewHref) + Number(!!onEdit) + Number(!!onDuplicate) + 1);
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    const top = window.innerHeight - rect.bottom < height + 12
      ? Math.max(8, rect.top - height - 6)
      : rect.bottom + 6;
    setPosition({ top, left });
  }, [viewHref, onEdit, onDuplicate]);

  React.useEffect(() => {
    if (!open) return;
    reposition();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
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
    if (open) {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [open, position]);

  function runAction(callback: () => void) {
    setOpen(false);
    callback();
  }

  const optionClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground outline-none hover:bg-[var(--table-hover)] focus-visible:bg-[var(--table-hover)]";

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        variant="ghost"
        size="icon-sm"
        className="size-7"
        title={"Actions for " + itemName}
        aria-label={"Actions for " + itemName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((previous) => !previous)}
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
          ref={menuRef}
          role="menu"
          id={id}
          aria-label={"Actions for " + itemName}
          style={{
            position: "fixed",
            top: position.top,
            left: position.left,
            zIndex: 80,
            width: 164,
          }}
          className="rounded-lg border border-border bg-white p-1 shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              triggerRef.current?.focus();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
              const current = items.indexOf(document.activeElement as HTMLElement);
              const step = event.key === "ArrowDown" ? 1 : -1;
              items[(current + step + items.length) % items.length]?.focus();
            } else if (event.key === "Tab") {
              setOpen(false);
            }
          }}
        >
          {viewHref && (
            <Link
              role="menuitem"
              href={viewHref}
              className={optionClass}
              onClick={() => setOpen(false)}
            >
              <Eye aria-hidden="true" className="size-4" /> {viewLabel}
            </Link>
          )}
          {onEdit && (
            <button
              type="button"
              role="menuitem"
              className={optionClass}
              onClick={() => runAction(onEdit)}
            >
              <Pencil aria-hidden="true" className="size-4" /> Edit
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              role="menuitem"
              className={optionClass}
              onClick={() => runAction(onDuplicate)}
            >
              <Copy aria-hidden="true" className="size-4" /> Duplicate job
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive outline-none hover:bg-red-50 focus-visible:bg-red-50"
            onClick={() => runAction(onDelete)}
          >
            <Trash2 aria-hidden="true" className="size-4" /> {deleteLabel}
          </button>
        </div>,
        document.body
      )}
    </>
  );
}
