"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardCheck, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { TablePagination } from "@/components/ui/table-pagination";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest } from "@/lib/http";
import { dateLabel } from "@/lib/schedule";
import type { SiteReportSummary } from "@/lib/site-report";

export function SiteReportList() {
  const [reports, setReports] = React.useState<SiteReportSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [dateFilter, setDateFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [deleteTarget, setDeleteTarget] = React.useState<SiteReportSummary | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");

  React.useEffect(() => {
    apiRequest<SiteReportSummary[]>("/api/site-reports")
      .then(setReports)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Unable to load site reports."))
      .finally(() => setLoading(false));
  }, []);

  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = reports.filter((report) => {
    if (dateFilter && report.date !== dateFilter) return false;
    const text = [report.jobNo, report.projectName, report.clientName, report.createdBy].join(" ").toLowerCase();
    return terms.every((term) => text.includes(term));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      await apiRequest("/api/site-reports/" + encodeURIComponent(deleteTarget.id), { method: "DELETE" });
      setReports((current) => current.filter((report) => report.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Unable to delete the report.");
    } finally { setDeleting(false); }
  }

  return (
    <main className="w-full min-w-0 max-w-none px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-12">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="technical-eyebrow mb-1.5">OPERATIONS / SITE REPORTS</p>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-primary sm:text-[32px]">Site Daily Reports</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Daily labour and equipment submitted per job order.</p>
        </div>
        <Button asChild className="h-10 w-full sm:w-auto">
          <Link href="/site-reports/new"><Plus /> New Report</Link>
        </Button>
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <section className="min-w-0 rounded-xl border border-border bg-white">
        <div className="flex flex-col gap-3 border-b border-border px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h2 className="text-base font-semibold">Report register</h2>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Job order, project, client..." aria-label="Search site reports" className="pl-9" />
            </div>
            <Input type="date" value={dateFilter} aria-label="Filter by report date" className="w-full sm:w-40"
              onChange={(event) => { setDateFilter(event.target.value); setPage(1); }} />
            {dateFilter && <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Clear</Button>}
          </div>
        </div>
        <Table className="min-w-[900px]">
          <TableHeader className="bg-[#f0f5fa]">
            <TableRow>
              <TableHead className="pl-4">Date</TableHead>
              <TableHead>Job order no.</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Labour</TableHead>
              <TableHead className="text-right">OT hrs</TableHead>
              <TableHead className="text-right">Equipment</TableHead>
              <TableHead>Submitted by</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visible.map((report) => (
              <TableRow key={report.id} className="h-11">
                <TableCell className="pl-4">
                  <Link href={"/site-reports/" + report.id} className="font-semibold hover:underline">{dateLabel(report.date)}</Link>
                </TableCell>
                <TableCell className="font-mono text-xs font-semibold text-primary">{report.jobNo || "—"}</TableCell>
                <TableCell>
                  <span className="block font-medium">{report.projectName || "—"}</span>
                  <span className="block text-xs text-muted-foreground">{report.clientName}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{report.labourCount}</TableCell>
                <TableCell className="text-right tabular-nums">{report.otHours}</TableCell>
                <TableCell className="text-right tabular-nums">{report.equipmentCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{report.createdBy ?? "—"}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end">
                    <RowActionsMenu itemName={"report " + (report.jobNo || "") + " " + report.date}
                      viewHref={"/site-reports/" + report.id} viewLabel="Open report"
                      onDelete={() => { setDeleteTarget(report); setDeleteError(""); }} disabled={deleting} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(loading || filtered.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <ClipboardCheck className="size-7 text-muted-foreground" />
                    <p className="text-sm font-semibold">{loading ? "Loading site reports..." : "No site reports found"}</p>
                    <p className="text-sm text-muted-foreground">
                      {loading ? "Retrieving report records." : search || dateFilter ? "Try another search or clear the filters." : "Submit the first site daily report."}
                    </p>
                    {!loading && !search && !dateFilter && (
                      <Button variant="outline" size="sm" className="mt-2" asChild>
                        <Link href="/site-reports/new"><Plus /> New Report</Link>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination total={filtered.length} page={currentPage} pageSize={pageSize} onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} disabled={loading} />
      </section>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete site report</DialogTitle>
            <DialogDescription>
              Delete the report for {deleteTarget?.jobNo || "this job"} on {deleteTarget ? dateLabel(deleteTarget.date) : ""}?
              Its labour and equipment entries are deleted too. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
