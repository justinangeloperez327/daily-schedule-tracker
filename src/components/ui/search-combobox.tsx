"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
};

type Props = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder: string;
  disabled?: boolean;
};

type Position = { top: number; left: number; width: number; maxHeight: number };

export function SearchCombobox({ label, value, onValueChange, options, placeholder, disabled = false }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const listId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [position, setPosition] = React.useState<Position | null>(null);

  const selected = options.find((option) => option.value === value);
  const filtered = React.useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return options.filter((option) => {
      const text = [option.label, option.description, option.searchText].filter(Boolean).join(" ").toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    }).slice(0, 100);
  }, [options, query]);

  const updatePosition = React.useCallback(() => {
    const anchor = wrapperRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const horizontalMargin = 12;
    const width = Math.min(window.innerWidth - horizontalMargin * 2, Math.max(rect.width, 360));
    const left = Math.max(horizontalMargin, Math.min(rect.left, window.innerWidth - width - horizontalMargin));
    const roomBelow = window.innerHeight - rect.bottom - 12;
    const roomAbove = rect.top - 12;
    const useAbove = roomBelow < 200 && roomAbove > roomBelow;
    const maxHeight = Math.max(100, Math.min(320, useAbove ? roomAbove - 6 : roomBelow - 6));
    setPosition({
      left, width, maxHeight,
      top: useAbove ? Math.max(12, rect.top - maxHeight - 6) : rect.bottom + 6,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
        setQuery("");
      }
    };
    const handleReposition = () => updatePosition();
    document.addEventListener("pointerdown", handleOutside);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("pointerdown", handleOutside);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open, updatePosition]);

  function choose(option: ComboboxOption) {
    if (option.disabled) return;
    onValueChange(option.value);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function advance(step: number) {
    if (!filtered.length) return;
    let next = activeIndex;
    for (let i = 0; i < filtered.length; i += 1) {
      next = (next + step + filtered.length) % filtered.length;
      if (!filtered[next].disabled) {
        setActiveIndex(next);
        return;
      }
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0 w-full">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && filtered[activeIndex] && !filtered[activeIndex].disabled
          ? listId + "-option-" + activeIndex : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : selected?.label ?? ""}
        onFocus={() => { setQuery(""); setActiveIndex(0); setOpen(true); }}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) { setOpen(true); setQuery(""); setActiveIndex(-1); }
            else advance(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) { setOpen(true); setQuery(""); setActiveIndex(0); }
            else advance(-1);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            const choice = filtered[activeIndex] && !filtered[activeIndex].disabled
              ? filtered[activeIndex]
              : filtered.find((option) => !option.disabled);
            if (choice) choose(choice);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
            setQuery("");
          } else if (event.key === "Tab") {
            setOpen(false);
            setQuery("");
          }
        }}
        className={cn(
          "h-10 w-full min-w-0 rounded-md border border-input bg-background pl-9 pr-9 text-sm",
          "text-foreground outline-none placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      {open && position && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          aria-label={label + " options"}
          style={{ position: "fixed", zIndex: 100, top: position.top, left: position.left,
            width: position.width, maxHeight: position.maxHeight }}
          className="overflow-y-auto overscroll-contain rounded-lg border border-border bg-white p-1.5 shadow-xl"
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matching records.</p>
          ) : (
            filtered.map((option, index) => (
              <div
                key={option.value}
                id={listId + "-option-" + index}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={cn(
                  "flex min-h-10 items-start justify-between gap-3 rounded-md px-3 py-2",
                  "text-sm transition-colors",
                  option.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-[var(--table-hover)]",
                  !option.disabled && index === activeIndex && "bg-[var(--table-hover)]"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-medium leading-5">{option.label}</span>
                  {option.description && (
                    <span className="mt-1 block break-words text-xs leading-4 text-muted-foreground">{option.description}</span>
                  )}
                </span>
                {value === option.value && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
              </div>
            ))
          )}
          {options.length > 100 && filtered.length === 100 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Showing the first 100 results. Type to narrow the list.</p>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
