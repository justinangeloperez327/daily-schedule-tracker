"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  blankDraft,
  dateKey,
  dateLabel,
  demoEntries,
  isScheduleEntry,
  shiftDate,
  STORAGE_KEY,
  timeLabel,
  type ScheduleDraft,
  type ScheduleEntry,
} from "@/lib/schedule";

export function ScheduleTracker() {
  const [selectedDate, setSelectedDate] = React.useState("");
  const [entries, setEntries] = React.useState<ScheduleEntry[]>([]);
  const [hydrated, setHydrated] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<ScheduleDraft>(blankDraft(""));
  const [formError, setFormError] = React.useState("");
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState("");

  React.useEffect(() => {
    const today = dateKey(new Date());
    let initialEntries = demoEntries(today);

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);
        initialEntries = Array.isArray(parsed) ? parsed.filter(isScheduleEntry) : [];
      }
    } catch {
      // Private browsing or corrupt storage should not prevent the UI from loading.
    }

    // Defer hydration to avoid synchronously updating React state in an effect.
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setSelectedDate(today);
      setEntries(initialEntries);
      setHydrated(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // The UI remains usable when browser storage is disabled or full.
    }
  }, [entries, hydrated]);

  const visibleEntries = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries
      .filter((entry) => entry.date === selectedDate)
      .filter((entry) => {
        if (!term) return true;
        return [
          entry.jobNo,
          entry.projectName,
          entry.clientName,
          entry.labours,
          entry.equipment,
          entry.scope,
        ].some((field) => field.toLowerCase().includes(term));
      })
      .sort((a, b) => a.timeIn.localeCompare(b.timeIn) || a.jobNo.localeCompare(b.jobNo));
  }, [entries, query, selectedDate]);

  const dayTotal = entries.filter((entry) => entry.date === selectedDate).length;
  const hasSamples = entries.some((entry) => entry.isSample);

  async function handleExport() {
    if (!selectedDate || exporting) return;

    // Export all jobs for this date, even if the search box is filtering the table.
    const dayEntries = entries.filter((entry) => entry.date === selectedDate);
    if (dayEntries.length === 0) return;

    setExporting(true);
    setExportError("");
    try {
      // ExcelJS is loaded only when the user requests an Excel export.
      const { exportScheduleToExcel } = await import("@/lib/export-schedule");
      await exportScheduleToExcel(selectedDate, dayEntries);
    } catch (error) {
      console.error("Excel export failed:", error);
      setExportError("Unable to create the Excel file. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function openNew() {
    setEditingId(null);
    setDraft(blankDraft(selectedDate));
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(entry: ScheduleEntry) {
    setEditingId(entry.id);
    setDraft({
      date: entry.date,
      jobNo: entry.jobNo,
      projectName: entry.projectName,
      clientName: entry.clientName,
      labours: entry.labours,
      equipment: entry.equipment,
      timeIn: entry.timeIn,
      timeOut: entry.timeOut,
      scope: entry.scope,
    });
    setFormError("");
    setDialogOpen(true);
  }

  function updateDraft(field: keyof ScheduleDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (formError) setFormError("");
  }

  function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleaned = {
      ...draft,
      jobNo: draft.jobNo.trim(),
      projectName: draft.projectName.trim(),
      clientName: draft.clientName.trim(),
      labours: draft.labours.trim(),
      equipment: draft.equipment.trim(),
      scope: draft.scope.trim(),
    };

    if (
      !cleaned.date ||
      !cleaned.jobNo ||
      !cleaned.projectName ||
      !cleaned.clientName ||
      !cleaned.timeIn ||
      !cleaned.timeOut ||
      !cleaned.scope
    ) {
      setFormError("Fill in the required fields before saving.");
      return;
    }

    if (editingId) {
      setEntries((current) =>
        current.map((entry) =>
          entry.id === editingId ? { ...cleaned, id: entry.id } : entry
        )
      );
    } else {
      setEntries((current) => [
        ...current,
        { ...cleaned, id: window.crypto.randomUUID() },
      ]);
    }

    setSelectedDate(cleaned.date);
    setDialogOpen(false);
  }

  function deleteEntry(entry: ScheduleEntry) {
    if (
      !window.confirm(
        "Delete schedule " + entry.jobNo + "? This cannot be undone."
      )
    ) {
      return;
    }
    setEntries((current) => current.filter((item) => item.id !== entry.id));
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[#20262e] text-white">
            <CalendarDays className="size-[18px]" />
          </div>
          <span className="text-sm font-semibold tracking-tight sm:text-base">
            Daily Schedule Tracker
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 pb-16 pt-9 sm:px-8 lg:px-10 lg:pt-12">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-foreground sm:text-[32px]">
              Daily Schedule
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              A clear view of scheduled jobs, labour, equipment, and site activities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="h-10 px-4"
              onClick={handleExport}
              disabled={!hydrated || !selectedDate || dayTotal === 0 || exporting}
              title="Export all jobs for the selected date to Excel"
              aria-label="Export selected day's schedule to Excel"
            >
              <Download className="size-4" />
              {exporting ? "Exporting..." : "Export to Excel"}
            </Button>
            <Button onClick={openNew} disabled={!hydrated} className="h-10 px-4">
              <Plus className="size-4" />
              Add Schedule
            </Button>
          </div>
        </div>

        {exportError && (
          <p role="alert" className="mb-4 text-sm text-destructive">
            {exportError}
          </p>
        )}

        <section className="rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-tight">
                {dateLabel(selectedDate)}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {dayTotal} {dayTotal === 1 ? "job" : "jobs"} scheduled
                {hasSamples ? " · Sample entries are editable" : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous day"
                title="Previous day"
                disabled={!selectedDate}
                onClick={() => setSelectedDate((date) => shiftDate(date, -1))}
              >
                <ChevronLeft />
              </Button>
              <Input
                type="date"
                aria-label="Schedule date"
                value={selectedDate}
                onChange={(event) => {
                  if (event.target.value) setSelectedDate(event.target.value);
                }}
                className="w-[154px] sm:w-[168px]"
              />
              <Button
                size="icon"
                variant="outline"
                aria-label="Next day"
                title="Next day"
                disabled={!selectedDate}
                onClick={() => setSelectedDate((date) => shiftDate(date, 1))}
              >
                <ChevronRight />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="ml-1"
                onClick={() => setSelectedDate(dateKey(new Date()))}
              >
                Today
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <p className="text-sm font-medium text-foreground">Schedule overview</p>
            <div className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search schedule"
                placeholder="Search schedules..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table className="min-w-[1170px]">
            <TableHeader className="bg-[#f8f9fa]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px] pl-6">Job No</TableHead>
                <TableHead className="w-[190px]">Project Name</TableHead>
                <TableHead className="w-[150px]">Client Name</TableHead>
                <TableHead className="w-[170px]">Labours</TableHead>
                <TableHead className="w-[170px]">Equipment</TableHead>
                <TableHead className="w-[155px]">Time (In / Out)</TableHead>
                <TableHead className="min-w-[240px]">Scope</TableHead>
                <TableHead className="w-[90px] pr-6 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow key={entry.id} className="group">
                  <TableCell className="pl-6 font-medium text-foreground">
                    {entry.jobNo}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {entry.projectName}
                  </TableCell>
                  <TableCell className="text-[#545b64]">
                    {entry.clientName}
                  </TableCell>
                  <TableCell className="whitespace-pre-wrap text-[#545b64]">
                    {entry.labours || "—"}
                  </TableCell>
                  <TableCell className="whitespace-pre-wrap text-[#545b64]">
                    {entry.equipment || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-foreground">{timeLabel(entry.timeIn)}</span>
                    <span className="mx-1.5 text-muted-foreground">–</span>
                    <span className="font-medium text-foreground">{timeLabel(entry.timeOut)}</span>
                  </TableCell>
                  <TableCell className="max-w-[330px] whitespace-pre-wrap text-[#545b64]">
                    {entry.scope}
                  </TableCell>
                  <TableCell className="pr-5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={"Edit " + entry.jobNo}
                        title={"Edit " + entry.jobNo}
                        onClick={() => openEdit(entry)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={"Delete " + entry.jobNo}
                        title={"Delete " + entry.jobNo}
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteEntry(entry)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {visibleEntries.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={8} className="py-20 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#f3f5f7] text-[#6b7280]">
                        <ClipboardList className="size-5" />
                      </div>
                      <h3 className="text-sm font-semibold">
                        {query.trim() ? "No matching schedules" : "No jobs scheduled"}
                      </h3>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {query.trim()
                          ? "Try another search term or date."
                          : "Add your first job to organize work for this date."}
                      </p>
                      {!query.trim() && hydrated && (
                        <Button variant="outline" size="sm" className="mt-5" onClick={openNew}>
                          <Plus />
                          Add a job
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
            Showing {visibleEntries.length} of {dayTotal} scheduled {dayTotal === 1 ? "job" : "jobs"}.
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Schedule data is stored in this browser. A shared database can be added later.
        </p>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit schedule" : "Add schedule"}</DialogTitle>
            <DialogDescription>
              Record the planned job, assigned resources, timing, and scope of work.
            </DialogDescription>
          </DialogHeader>

          <form className="mt-1 space-y-5" onSubmit={saveEntry}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-date">Schedule date <span aria-hidden="true">*</span></Label>
                <Input
                  id="schedule-date"
                  type="date"
                  required
                  value={draft.date}
                  onChange={(event) => updateDraft("date", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-no">Job No <span aria-hidden="true">*</span></Label>
                <Input
                  id="job-no"
                  required
                  placeholder="e.g. G-SO-26-00001"
                  value={draft.jobNo}
                  onChange={(event) => updateDraft("jobNo", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name <span aria-hidden="true">*</span></Label>
                <Input
                  id="project-name"
                  required
                  placeholder="e.g. Entrance gate works"
                  value={draft.projectName}
                  onChange={(event) => updateDraft("projectName", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-name">Client Name <span aria-hidden="true">*</span></Label>
                <Input
                  id="client-name"
                  required
                  placeholder="Client or main contractor"
                  value={draft.clientName}
                  onChange={(event) => updateDraft("clientName", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="labours">Labours</Label>
                <Input
                  id="labours"
                  placeholder="e.g. 4 installers, 2 helpers"
                  value={draft.labours}
                  onChange={(event) => updateDraft("labours", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment">Equipment</Label>
                <Input
                  id="equipment"
                  placeholder="e.g. Boom lift, pickup"
                  value={draft.equipment}
                  onChange={(event) => updateDraft("equipment", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-in">Time In <span aria-hidden="true">*</span></Label>
                <Input
                  id="time-in"
                  type="time"
                  required
                  value={draft.timeIn}
                  onChange={(event) => updateDraft("timeIn", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-out">Time Out <span aria-hidden="true">*</span></Label>
                <Input
                  id="time-out"
                  type="time"
                  required
                  value={draft.timeOut}
                  onChange={(event) => updateDraft("timeOut", event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Scope <span aria-hidden="true">*</span></Label>
              <Textarea
                id="scope"
                required
                rows={3}
                placeholder="Describe the planned site activity..."
                value={draft.scope}
                onChange={(event) => updateDraft("scope", event.target.value)}
              />
            </div>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingId ? "Save changes" : "Add schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
