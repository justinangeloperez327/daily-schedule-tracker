import type { TableSortDirection } from "@/components/ui/sortable-table-head";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural, case-insensitive ordering. Missing values sort last in both directions. */
export function compareTableValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  direction: TableSortDirection,
): number {
  const left = a == null ? "" : String(a).trim();
  const right = b == null ? "" : String(b).trim();
  if (!left && right) return 1;
  if (!right && left) return -1;
  const comparison = typeof a === "number" && typeof b === "number"
    ? a - b
    : collator.compare(left, right);
  return direction === "asc" ? comparison : -comparison;
}
