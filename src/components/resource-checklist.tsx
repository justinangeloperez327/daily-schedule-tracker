"use client";

import * as React from "react";
import { Check, Search, UsersRound, Wrench, HardHat } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ComboboxOption } from "@/components/ui/search-combobox";

export type PlanningResourceOption = ComboboxOption & {
  invalid?: boolean;
  otherJobs?: number[];
};

type ResourceChecklistProps = {
  title: "Foremen" | "Labourers" | "Equipment";
  jobNumber: number;
  options: PlanningResourceOption[];
  selectedIds: string[];
  onToggle: (id: string, selected: boolean) => void;
  maxSelected: number;
  disabled?: boolean;
  emptyHint: string;
  compact?: boolean;
  fillHeight?: boolean;
};

const icons = { Foremen: HardHat, Labourers: UsersRound, Equipment: Wrench };

export function ResourceChecklist({
  title, jobNumber, options, selectedIds, onToggle, maxSelected,
  disabled = false, emptyHint, compact = false, fillHeight = false,
}: ResourceChecklistProps) {
  const [query, setQuery] = React.useState("");
  const selected = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const filtered = React.useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return options
      .filter((item) => !term || [
        item.label, item.description, item.searchText, item.value,
      ].some((value) => value?.toLocaleLowerCase().includes(term)))
      .sort((a, b) => {
        if (selected.has(a.value) !== selected.has(b.value)) return selected.has(a.value) ? -1 : 1;
        return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [options, query, selected]);
  const limitReached = selected.size >= maxSelected;
  const Icon = icons[title];
  const inputId = React.useId();

  return (
    <section className={(fillHeight ? "h-full min-h-0 " : "") + "flex min-w-0 flex-col rounded-lg border border-border bg-white"}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-[#F8FAFD] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-[#365F91]" />
          <h4 className="truncate text-sm font-semibold text-primary">{title}</h4>
        </div>
        <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#365F91]">
          {selected.size} selected
        </span>
      </div>
      <div className="px-3 pb-2 pt-3">
        <label htmlFor={inputId} className="sr-only">
          Search {title.toLowerCase()} for job {jobNumber}
        </label>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Search " + title.toLowerCase() + "..."}
            className="h-9 pl-9"
            disabled={disabled}
          />
        </div>
      </div>
      <div
        role="group"
        aria-label={title + " for job " + jobNumber}
        tabIndex={0}
        className={(fillHeight ? "min-h-0 flex-1" : compact ? "h-36 min-h-0" : "h-56 min-h-0") + " mx-2 mb-2 space-y-1 overflow-y-scroll overscroll-contain rounded-md border border-border/80 bg-white p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [scrollbar-gutter:stable]"}
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">
            {options.length === 0 ? emptyHint : "No matching " + title.toLowerCase() + "."}
          </p>
        ) : (
          filtered.map((item) => {
            const checked = selected.has(item.value);
            const cannotSelect = Boolean(item.invalid && !checked) || (limitReached && !checked);
            return (
              <label
                key={item.value}
                className={"flex min-w-0 items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors " +
                  (item.invalid ? "bg-amber-50" : checked ? "bg-[#EAF2FC]" : "hover:bg-[#F5F8FC]") +
                  (disabled || cannotSelect ? " cursor-not-allowed" : " cursor-pointer")}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#365F91] disabled:cursor-not-allowed"
                  checked={checked}
                  disabled={disabled || cannotSelect}
                  onChange={(event) => onToggle(item.value, event.target.checked)}
                  aria-label={(checked ? "Unassign " : "Assign ") + item.label + " from/to job " + jobNumber}
                  aria-invalid={item.invalid || undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-words text-xs font-medium leading-5 text-[#172B45]">
                      {item.label}
                    </span>
                    {checked && <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#365F91]" />}
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block break-words text-[11px] leading-4 text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  {item.invalid && (
                    <span className="mt-1 block text-[11px] font-medium text-amber-800">
                      No longer eligible — uncheck to remove
                    </span>
                  )}
                  {item.otherJobs && item.otherJobs.length > 0 && (
                    <span className="mt-1 block text-[11px] text-[#365F91]">
                      Also selected in Job {item.otherJobs.join(", ")} of this plan
                    </span>
                  )}
                </span>
              </label>
            );
          })
        )}
      </div>
      <p className="px-3 pb-3 text-[11px] leading-4 text-muted-foreground">
        Choose from the scrollable list · {selected.size} / {maxSelected} · minimum 1
      </p>
    </section>
  );
}
