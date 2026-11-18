"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type TableSortDirection = "asc" | "desc";

type Props = {
  label: string;
  direction?: TableSortDirection;
  onSort: () => void;
  className?: string;
  title?: string;
};

export function SortableTableHead({ label, direction, onSort, className, title }: Props) {
  return (
    <TableHead
      scope="col"
      aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("h-9 px-4 py-1.5", className)}
    >
      <button
        type="button"
        title={title || "Sort by " + label}
        aria-label={"Sort by " + label + (direction === "asc" ? " descending" : " ascending")}
        className="inline-flex w-full items-center gap-1.5 text-left uppercase text-inherit outline-none transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30"
        onClick={onSort}
      >
        <span className="min-w-0 break-words">{label}</span>
        {direction === "asc" ? <ArrowUp aria-hidden="true" className="size-3.5 shrink-0" /> :
          direction === "desc" ? <ArrowDown aria-hidden="true" className="size-3.5 shrink-0" /> :
            <ArrowUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-45" />}
      </button>
    </TableHead>
  );
}
