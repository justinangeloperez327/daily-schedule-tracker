"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SortableTableHead, type TableSortDirection } from "@/components/ui/sortable-table-head";
import { TablePagination } from "@/components/ui/table-pagination";
import { compareTableValues } from "@/lib/table-sort";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/http";
import { dateLabel } from "@/lib/schedule";

type ScheduleSummary = {
  id: string;
  date: string;
  jobs: number;
  teamDispatches: number;
  day: number;
  night: number;
  updatedAt: string;
};

type ScheduleSortKey = "date" | "jobs" | "teamDispatches" | "shift" | "updatedAt";

export function ScheduleTracker() {
  const [sheets, setSheets] = React.useState<ScheduleSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ScheduleSummary | null>(null);
  const [deleteError, setDeleteError] = React.useState("");
  const [sort, setSort] = React.useState<{ key: ScheduleSortKey; direction: TableSortDirection }>({
    key: "date", direction: "desc",
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    let mounted = true;
    apiRequest<ScheduleSummary[]>("/api/schedules")
      .then((items) => { if (mounted) { setSheets(items); setError(""); } })
      .catch((cause: unknown) => { if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load schedules."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = sheets
    .filter((sheet) =>
      (!dateFilter || sheet.date === dateFilter) &&
      (!search.trim() || dateLabel(sheet.date).toLowerCase().includes(search.trim().toLowerCase()))
    )
    .sort((a, b) => {
      if (sort.key === "shift") {
        return compareTableValues(a.day, b.day, sort.direction) ||
          compareTableValues(a.night, b.night, sort.direction) ||
          compareTableValues(a.date, b.date, "desc");
      }
      return compareTableValues(a[sort.key], b[sort.key], sort.direction) ||
        compareTableValues(a.date, b.date, "desc") ||
        compareTableValues(a.id, b.id, "asc");
    });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function sortBy(key: ScheduleSortKey) {
    setSort((previous) => ({
      key,
      direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const id = deleteTarget.id;
    setDeleting(id);
    setDeleteError("");
    try {
      await apiRequest<{ success: true }>("/api/schedules/" + encodeURIComponent(id), { method: "DELETE" });
      setSheets((current) => current.filter((entry) => entry.id !== id));
      setDeleteTarget(null);
      setError("");
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Unable to delete schedule.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="w-full min-w-0 max-w-none px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-12">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div>
          <p className="technical-eyebrow mb-1.5">OPERATIONS / SCHEDULES</p>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-primary sm:text-[32px]">Schedules</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage daily work plans and dispatch teams in one register.
          </p>
        </div>
        <Button asChild className="h-10 w-full px-4 sm:w-auto">
          <Link href="/schedules/new"><Plus className="size-4" /> Create Schedule</Link>
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Schedules</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{sheets.length}</p>
        </div>
        <div className="rounded-xl border bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Jobs planned</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{sheets.reduce((sum, sheet) => sum + sheet.jobs, 0)}</p>
        </div>
        <div className="col-span-2 rounded-xl border bg-white px-4 py-3 sm:col-span-1 sm:px-5 sm:py-4">
          <p className="text-xs font-medium text-muted-foreground">Team dispatches</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{sheets.reduce((sum, sheet) => sum + sheet.teamDispatches, 0)}</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <section className="min-w-0 rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
        <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border px-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
          <div>
            <h2 className="text-base font-semibold">Schedule register</h2>
            <p className="mt-1 text-xs text-muted-foreground">One record contains multiple job dispatch rows.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search dates..." aria-label="Search schedules by date" className="w-full pl-9 sm:w-48" />
            </div>
            <Input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setPage(1); }}
              aria-label="Filter by schedule date" className="w-full sm:w-40" />
            {dateFilter && <Button variant="ghost" size="sm" onClick={() => { setDateFilter(""); setPage(1); }}>Clear</Button>}
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Density
              <select
                value={density}
                onChange={(event) => setDensity(event.target.value as "comfortable" | "compact")}
                aria-label="Schedule table density"
                className="h-9 rounded-md border border-input bg-white px-2 text-sm text-foreground"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>
        </div>

        <p className="px-3 py-2 text-xs text-muted-foreground sm:hidden">
          Scroll the table sideways to see every schedule column.
        </p>
        <Table className="min-w-[840px] table-fixed">
          <TableHeader className="bg-[#f0f5fa]">
            <TableRow className="h-9">
              {([
                ["date", "Schedule date", "w-[24%] pl-4"],
                ["jobs", "Jobs", "w-[10%]"],
                ["teamDispatches", "Team dispatches", "w-[17%]"],
                ["shift", "Day / Night", "w-[19%]"],
                ["updatedAt", "Last updated", "w-[22%]"],
              ] as const).map(([key, label, width]) => (
                <SortableTableHead
                  key={key}
                  label={label}
                  direction={sort.key === key ? sort.direction : undefined}
                  onSort={() => sortBy(key)}
                  title={key === "shift" ? "Sort by day shift count, then night shift count" : undefined}
                  className={"h-9 whitespace-nowrap " + width}
                />
              ))}
              <TableHead className="h-9 w-[8%] whitespace-nowrap pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visibleRows.map((sheet) => (
              <TableRow key={sheet.id} className={density === "comfortable" ? "h-9" : "h-8"}>
                <TableCell className="pl-4">
                  <Link href={"/schedules/" + sheet.id} className="inline-flex items-center gap-2 font-semibold hover:underline">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    {dateLabel(sheet.date)}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums font-medium">{sheet.jobs}</TableCell>
                <TableCell className="tabular-nums font-medium">{sheet.teamDispatches}</TableCell>
                <TableCell>{sheet.day} day / {sheet.night} night</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(sheet.updatedAt).toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <RowActionsMenu
                      itemName={"schedule " + dateLabel(sheet.date)}
                      viewHref={"/schedules/" + sheet.id}
                      viewLabel="Open schedule"
                      onDelete={() => { setDeleteTarget(sheet); setDeleteError(""); }}
                      disabled={!!deleting}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(loading || filtered.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <ClipboardList className="size-7 text-muted-foreground" />
                    <p className="text-sm font-semibold">{loading ? "Loading schedules..." : "No schedules found"}</p>
                    <p className="text-sm text-muted-foreground">
                      {loading ? "Retrieving schedule records." : (dateFilter || search) ? "Try another date or clear the filters." : "Create the first daily schedule to get started."}
                    </p>
                    {!loading && !dateFilter && !search && (
                      <Button variant="outline" size="sm" className="mt-2" asChild>
                        <Link href="/schedules/new"><Plus /> Create Schedule</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={filtered.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          disabled={loading}
        />
      </section>
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete schedule</DialogTitle>
            <DialogDescription>
              Delete the schedule for {deleteTarget ? dateLabel(deleteTarget.date) : ""}?
              All {deleteTarget?.teamDispatches ?? 0} team dispatches in this schedule
              will be deleted. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={!!deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={!!deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
