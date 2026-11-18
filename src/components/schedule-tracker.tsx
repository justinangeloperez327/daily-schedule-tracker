"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Plus, Search, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export function ScheduleTracker() {
  const [sheets, setSheets] = React.useState<ScheduleSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    apiRequest<ScheduleSummary[]>("/api/schedules")
      .then((items) => { if (mounted) { setSheets(items); setError(""); } })
      .catch((cause: unknown) => { if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load schedules."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const filtered = sheets.filter((sheet) =>
    (!dateFilter || sheet.date === dateFilter) &&
    (!search.trim() || dateLabel(sheet.date).toLowerCase().includes(search.trim().toLowerCase()))
  );

  async function remove(sheet: ScheduleSummary) {
    if (!window.confirm("Delete the entire schedule for " + dateLabel(sheet.date) +
      "? All " + sheet.teamDispatches + " team dispatches in this schedule will be deleted.")) return;
    setDeleting(sheet.id);
    setError("");
    try {
      await apiRequest<{ success: true }>("/api/schedules/" + encodeURIComponent(sheet.id), { method: "DELETE" });
      setSheets((current) => current.filter((entry) => entry.id !== sheet.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete schedule.");
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
              <Input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dates..." aria-label="Search schedules by date" className="w-full pl-9 sm:w-48" />
            </div>
            <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filter by schedule date" className="w-full sm:w-40" />
            {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
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
              <TableHead className="h-9 w-[24%] whitespace-nowrap pl-4">Schedule date</TableHead>
              <TableHead className="h-9 w-[9%] whitespace-nowrap">Jobs</TableHead>
              <TableHead className="h-9 w-[15%] whitespace-nowrap">Team dispatches</TableHead>
              <TableHead className="h-9 w-[17%] whitespace-nowrap">Day / Night</TableHead>
              <TableHead className="h-9 w-[19%] whitespace-nowrap">Last updated</TableHead>
              <TableHead className="h-9 w-[16%] whitespace-nowrap pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filtered.map((sheet) => (
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
                  <div className="flex flex-nowrap justify-end gap-1">
                    <Button variant="outline" size="sm" className="h-7 px-2" asChild>
                      <Link href={"/schedules/" + sheet.id}><ExternalLink className="size-3.5" /> Open</Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive"
                      disabled={deleting === sheet.id} aria-label={"Delete schedule " + sheet.date}
                      onClick={() => remove(sheet)}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
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
        <div className="border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:px-6">
          Showing {loading ? 0 : filtered.length} of {sheets.length} schedules
        </div>
      </section>
    </main>
  );
}
