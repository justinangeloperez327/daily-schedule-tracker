"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

type TablePaginationProps = {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  disabled?: boolean;
};

export function TablePagination({
  total, page, pageSize, onPageChange, onPageSizeChange, disabled = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const from = total ? (currentPage - 1) * pageSize + 1 : 0;
  const to = Math.min(total, currentPage * pageSize);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p className="technical-number text-xs text-muted-foreground" aria-live="polite">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end sm:gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Rows per page
          <select
            aria-label="Rows per page"
            value={pageSize}
            disabled={disabled}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-md border border-input bg-white px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {PAGE_SIZES.map((size) => <option value={size} key={size}>{size}</option>)}
          </select>
        </label>
        <span className="technical-number text-xs text-muted-foreground">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline" size="icon-sm"
          title="Previous page" aria-label="Previous page"
          disabled={disabled || currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline" size="icon-sm"
          title="Next page" aria-label="Next page"
          disabled={disabled || currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
