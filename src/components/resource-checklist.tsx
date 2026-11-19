"use client";

import * as React from "react";
import { GripVertical, HardHat, Search, UsersRound, Wrench } from "lucide-react";
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
  selectedIds: string[];
  onAssign: (id: string) => void;
  onDragStart: (event: React.DragEvent<HTMLButtonElement>, id: string) => void;
  onDragEnd: () => void;
  maxSelected: number;
  disabled?: boolean;
  emptyHint: string;
  fillHeight?: boolean;
};

const icons = { Foremen: HardHat, Labourers: UsersRound, Equipment: Wrench };

export function ResourceChecklist({
  title, jobNumber, options, selectedIds, onAssign, onDragStart, onDragEnd,
  maxSelected, disabled = false, emptyHint, fillHeight = false,
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
  const Icon = icons[title];
  const inputId = React.useId();

  return (
    <section className={(fillHeight ? "h-full min-h-0 " : "") +
      "flex min-w-0 flex-col rounded-lg border border-border bg-white"}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-[#F8FAFD] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-[#365F91]" />
          <h4 className="truncate text-sm font-semibold text-primary">{title}</h4>
        </div>
        <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#365F91]">
          {selectedIds.length} assigned
        </span>
      </div>
      <div className="shrink-0 px-3 pb-2 pt-3">
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
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Drag a resource card onto a job, or click to assign to the selected job.
        </p>
      </div>
      <div
        role="group"
        aria-label={title + " for job " + jobNumber}
        tabIndex={0}
        className={(fillHeight ? "min-h-0 flex-1" : "h-56 min-h-0") +
          " mx-2 mb-2 space-y-1.5 overflow-y-scroll overscroll-contain rounded-md border border-border/80 bg-[#FCFDFE] p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [scrollbar-gutter:stable]"}
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
                className={"flex w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors " +
                  (assigned ? "cursor-not-allowed border-[#DCE5EF] bg-[#EEF2F7] opacity-65" :
                    item.invalid ? "cursor-not-allowed border-amber-200 bg-amber-50 opacity-75" :
                      "cursor-grab border-[#DCE5EF] bg-white hover:border-[#365F91] hover:bg-[#EAF2FC] active:cursor-grabbing")}
              >
                <GripVertical aria-hidden="true" className={"mt-0.5 size-4 shrink-0 " +
                  (canDrag ? "text-[#365F91]" : "text-muted-foreground")} />
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
                  {canDrag && (
                    <span className="mt-1 block text-[11px] text-[#365F91]">
                      Drag to job or click to assign
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
      <p className="shrink-0 px-3 pb-3 text-[11px] leading-4 text-muted-foreground">
        {selectedIds.length} / {maxSelected} assigned to selected job · Assigned cards cannot be dragged
      </p>
    </section>
  );
}
