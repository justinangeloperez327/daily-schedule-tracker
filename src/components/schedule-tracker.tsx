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
  const [deleting, setDeleting] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    apiRequest<ScheduleSummary[]>("/api/schedule-sheets")
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
      await apiRequest<{ success: true }>("/api/schedule-sheets/" + encodeURIComponent(sheet.id), { method: "DELETE" });
      setSheets((current) => current.filter((entry) => entry.id !== sheet.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete schedule.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1500px] px-5 pb-16 pt-9 sm:px-8 lg:px-10 lg:pt-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] sm:text-[32px]">Schedules</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage daily work plans and dispatch teams in one register.
          </p>
        </div>
        <Button asChild={false} className="h-10 px-4">
          <Link href="/schedules/new"><Plus className="size-4" /> Create Schedule</Link>
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Schedules</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{sheets.length}</p>
        </div>
        <div className="rounded-xl border bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Jobs planned</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{sheets.reduce((sum, sheet) => sum + sheet.jobs, 0)}</p>
        </div>
        <div className="rounded-xl border bg-white px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground">Team dispatches</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{sheets.reduce((sum, sheet) => sum + sheet.teamDispatches, 0)}</p>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">Schedule register</h2>
            <p className="mt-1 text-xs text-muted-foreground">One record contains multiple job dispatch rows.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search dates..." aria-label="Search schedules by date" className="w-48 pl-9" />
            </div>
            <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Filter by schedule date" className="w-40" />
            {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
          </div>
        </div>

        <Table className="min-w-[800px]">
          <TableHeader className="bg-[#f8f9fa]">
            <TableRow>
              <TableHead className="pl-6">Schedule date</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Team dispatches</TableHead>
              <TableHead>Day / Night</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filtered.map((sheet) => (
              <TableRow key={sheet.id}>
                <TableCell className="pl-6">
                  <Link href={"/schedules/" + sheet.id} className="inline-flex items-center gap-2 font-semibold hover:underline">
                    <CalendarDays className="size-4 text-muted-foreground" />
                    {dateLabel(sheet.date)}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{sheet.jobs}</TableCell>
                <TableCell className="tabular-nums">{sheet.teamDispatches}</TableCell>
                <TableCell>{sheet.day} day / {sheet.night} night</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(sheet.updatedAt).toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" asChild={false}>
                      <Link href={"/schedules/" + sheet.id}><ExternalLink className="size-3.5" /> Open</Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
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
                      <Button variant="outline" size="sm" className="mt-2" asChild={false}>
                        <Link href="/schedules/new"><Plus /> Create Schedule</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="border-t px-6 py-3 text-xs text-muted-foreground">
          Showing {loading ? 0 : filtered.length} of {sheets.length} schedules
        </div>
      </section>
    </main>
  );
}
