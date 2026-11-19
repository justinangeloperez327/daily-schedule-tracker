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
  // Project-specific metadata is only rendered for the job selector.
  project?: {
    jobNo: string;
    projectName: string;
    clientName: string;
    soNo: string;
    hasName: boolean;
  };
};

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const terms = [...new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))];
  if (!terms.length) return <>{text}</>;
  const lower = text.toLocaleLowerCase();
  const ranges: { start: number; end: number }[] = [];
  for (const term of terms) {
    let cursor = 0;
    while (cursor < lower.length) {
      const start = lower.indexOf(term, cursor);
      if (start < 0) break;
      ranges.push({ start, end: start + term.length });
      cursor = start + term.length;
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof ranges = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  if (!merged.length) return <>{text}</>;
  const segments: React.ReactNode[] = [];
  let from = 0;
  merged.forEach(({ start, end }, index) => {
    if (start > from) segments.push(text.slice(from, start));
    segments.push(<mark key={index} className="rounded-sm bg-[#DDEBFA] text-inherit">{text.slice(start, end)}</mark>);
    from = end;
  });
  if (from < text.length) segments.push(text.slice(from));
  return <>{segments}</>;
}

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
    const matches = options.filter((option) => {
      const text = [option.label, option.description, option.searchText].filter(Boolean).join(" ").toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    });
    if (terms.length && matches.some((option) => option.project)) {
      const firstTerm = terms[0];
      const priority = (option: ComboboxOption) => {
        if (!option.project) return 5;
        const { jobNo, projectName, clientName, soNo } = option.project;
        const fields = [jobNo, projectName, clientName, soNo];
        const index = fields.findIndex((field) => field.toLocaleLowerCase().startsWith(firstTerm));
        return index === -1 ? 4 : index;
      };
      matches.sort((a, b) => priority(a) - priority(b));
    }
    return matches.slice(0, 100);
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
    const isProjectPicker = options.some((option) => option.project);
    const maxHeight = Math.max(100, Math.min(isProjectPicker ? 480 : 320,
      useAbove ? roomAbove - 6 : roomBelow - 6));
    setPosition({
      left, width, maxHeight,
      top: useAbove ? Math.max(12, rect.top - maxHeight - 6) : rect.bottom + 6,
    });
  }, [options]);

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

  React.useEffect(() => {
    if (!open || !menuRef.current) return;
    menuRef.current.querySelector<HTMLElement>(
      '[data-option-index="' + activeIndex + '"]'
    )?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

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
                data-option-index={index}
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                className={cn(
                  "flex min-h-10 items-start justify-between gap-3 rounded-md px-3 py-2",
                  "text-sm transition-colors",
                  option.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-[var(--table-hover)]",
                  !option.disabled && index === activeIndex && "bg-[var(--table-hover)]"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span className="min-w-0 flex-1">
                  {option.project ? (
                    <span className="block min-w-0 space-y-1">
                      <span className="block break-words font-mono text-[12px] font-semibold leading-5 text-primary">
                        <HighlightMatch text={option.project.jobNo} query={query} />
                      </span>
                      <span className={"block break-words text-[13px] leading-5 " +
                        (option.project.hasName ? "font-medium text-foreground" : "font-medium text-[#365F91]")}>
                        <HighlightMatch
                          text={option.project.hasName ? option.project.projectName : option.project.clientName}
                          query={query}
                        />
                      </span>
                      <span className="block break-words text-[11px] leading-4 text-muted-foreground">
                        {option.project.hasName ? (
                          <>Client: <HighlightMatch text={option.project.clientName} query={query} />{" · "}</>
                        ) : (
                          <>Project name not recorded{" · "}</>
                        )}
                        SO: <HighlightMatch text={option.project.soNo} query={query} />
                      </span>
                    </span>
                  ) : (
                    <>
                      <span className="block break-words font-medium leading-5">{option.label}</span>
                      {option.description && (
                        <span className="mt-1 block break-words text-xs leading-4 text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </>
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
