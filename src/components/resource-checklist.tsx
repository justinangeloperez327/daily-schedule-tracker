"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ComboboxOption } from "@/components/ui/search-combobox";

export type PlanningResourceOption = ComboboxOption & {
  invalid?: boolean;
  assignedJobs?: number[];
};

type ResourceChecklistProps = {
  title: "Foremen" | "Labourers" | "Equipment";
  jobNumber: number;
  options: PlanningResourceOption[];
  onAssign: (id: string) => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>, id: string) => void;
  onDragEnd: () => void;
  disabled?: boolean;
  emptyHint: string;
  fillHeight?: boolean;
};

export function ResourceChecklist({
  title, jobNumber, options, onAssign, onDragStart, onDragEnd,
  disabled = false, emptyHint, fillHeight = false,
}: ResourceChecklistProps) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return options
      .filter((item) => !term || [
        item.label, item.description, item.searchText, item.value,
      ].some((value) => value?.toLocaleLowerCase().includes(term)))
      .sort((a, b) => {
        const aAssigned = Boolean(a.assignedJobs?.length);
        const bAssigned = Boolean(b.assignedJobs?.length);
        if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
        return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [options, query]);
  const inputId = React.useId();

  return (
    <section className={(fillHeight ? "h-full min-h-0 " : "") +
      "flex min-w-0 flex-col bg-white"}>
      <div className="shrink-0 px-1 pb-2 pt-1">
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
        className={(fillHeight ? "min-h-0 flex-1" : "h-56 min-h-0") +
          " space-y-2 overflow-y-auto overscroll-contain bg-white p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [scrollbar-gutter:stable]"}
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs leading-5 text-muted-foreground">
            {options.length === 0 ? emptyHint : "No matching " + title.toLowerCase() + "."}
          </p>
        ) : (
          filtered.map((item) => {
            const assignedJobs = item.assignedJobs ?? [];
            const assigned = assignedJobs.length > 0;
            const unavailable = assigned || Boolean(item.invalid);
            const canDrag = !disabled && !unavailable;
            return (
              <button
                type="button"
                key={item.value}
                draggable={canDrag}
                disabled={!canDrag}
                onDragStart={(event) => onDragStart(event, item.value)}
                onDragEnd={onDragEnd}
                onClick={() => onAssign(item.value)}
                aria-label={assigned
                  ? item.label + " already assigned to Job " + assignedJobs.join(", ")
                  : "Assign " + item.label + " to selected Job " + jobNumber}
                className={"flex w-full min-w-0 items-start rounded-lg border px-3 py-3 text-left shadow-[0_1px_3px_rgba(23,43,69,0.035)] transition-colors " +
                  (assigned ? "cursor-not-allowed border-border bg-muted/70 opacity-60" :
                    item.invalid ? "cursor-not-allowed border-amber-200 bg-amber-50 opacity-75" :
                      "cursor-grab border-border bg-white hover:border-[#9DB5D1] hover:bg-[#EAF2FC] active:cursor-grabbing")}
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs font-semibold leading-5 text-primary">
                    {item.label}
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block break-words text-[11px] leading-4 text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  {assigned && (
                    <span className="mt-1 block text-[11px] font-medium text-[#50677F]">
                      Assigned · Job {assignedJobs.join(", ")}
                    </span>
                  )}
                  {!assigned && item.invalid && (
                    <span className="mt-1 block text-[11px] font-medium text-amber-800">
                      No longer eligible — remove from its job to clear
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
