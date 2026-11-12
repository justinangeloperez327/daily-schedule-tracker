"use client";

import * as React from "react";
import Link from "next/link";
import {
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
import { apiRequest } from "@/lib/http";
import type { Project, Employee, Equipment } from "@/lib/catalog";
import {
  blankDraft,
  dateKey,
  dateLabel,
  shiftDate,
  timeLabel,
  type ScheduleDraft,
  type ScheduleEntry,
} from "@/lib/schedule";

export function ScheduleTracker() {
  const [selectedDate, setSelectedDate] = React.useState("");
  const [entries, setEntries] = React.useState<ScheduleEntry[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [catalogLoading, setCatalogLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [catalogError, setCatalogError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<ScheduleDraft>(blankDraft(""));
  const [formError, setFormError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState("");

  React.useEffect(() => {
    // Initialize on the client so "today" follows the user's local timezone.
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) setSelectedDate(dateKey(new Date()));
    });
    return () => { mounted = false; };
  }, []);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      apiRequest<Project[]>("/api/projects"),
      apiRequest<Employee[]>("/api/employees"),
      apiRequest<Equipment[]>("/api/equipments"),
    ])
      .then(([projectRows, employeeRows, equipmentRows]) => {
        if (!alive) return;
        setProjects(projectRows);
        setEmployees(employeeRows);
        setEquipments(equipmentRows);
        setCatalogError("");
      })
      .catch((error: unknown) => {
        if (alive) setCatalogError(error instanceof Error ? error.message : "Unable to load resources.");
      })
      .finally(() => { if (alive) setCatalogLoading(false); });
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (!selectedDate) return;
    let alive = true;
    const controller = new AbortController();
    apiRequest<ScheduleEntry[]>(
      "/api/schedules?date=" + encodeURIComponent(selectedDate),
      { signal: controller.signal }
    )
      .then((records) => {
        if (!alive) return;
        setEntries(records);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setEntries([]);
        setLoadError(error instanceof Error ? error.message : "Unable to load schedule.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [selectedDate]);

  function changeDate(date: string) {
    if (!date || date === selectedDate) return;
    setEntries([]);
    setLoading(true);
    setLoadError("");
    setQuery("");
    setSelectedDate(date);
  }

  const visibleEntries = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries
      .filter((entry) =>
        !term || [
          entry.jobNo,
          entry.projectName,
          entry.clientName,
          entry.labours,
          entry.equipment,
          entry.scope,
        ].some((field) => field.toLowerCase().includes(term))
      )
      .sort((a, b) =>
        a.timeIn.localeCompare(b.timeIn) || a.jobNo.localeCompare(b.jobNo)
      );
  }, [entries, query]);

  const selectedProject = projects.find((project) => project.id === draft.projectId);

  async function handleExport() {
    if (!selectedDate || exporting || loading || entries.length === 0) return;
    setExporting(true);
    setExportError("");
    try {
      const { exportScheduleToExcel } = await import("@/lib/export-schedule");
      await exportScheduleToExcel(selectedDate, entries);
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
      projectId: entry.projectId,
      employeeIds: [...entry.employeeIds],
      equipmentIds: [...entry.equipmentIds],
      timeIn: entry.timeIn,
      timeOut: entry.timeOut,
      scope: entry.scope,
    });
    setFormError("");
    setDialogOpen(true);
  }

  function updateDraft<Key extends keyof ScheduleDraft>(field: Key, value: ScheduleDraft[Key]) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (formError) setFormError("");
  }

  function toggleResource(field: "employeeIds" | "equipmentIds", id: string, checked: boolean) {
    setDraft((current) => ({
      ...current,
      [field]: checked
        ? [...current[field], id]
        : current[field].filter((value) => value !== id),
    }));
  }

  async function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const cleaned: ScheduleDraft = {
      ...draft,
      jobNo: draft.jobNo.trim(),
      scope: draft.scope.trim(),
    };

    if (!cleaned.date || !cleaned.projectId || !cleaned.jobNo || !cleaned.timeIn || !cleaned.timeOut || !cleaned.scope) {
      setFormError("Fill in all required fields before saving.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const saved = await apiRequest<ScheduleEntry>(
        "/api/schedules" + (editingId ? "/" + encodeURIComponent(editingId) : ""),
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleaned),
        }
      );

      if (saved.date === selectedDate) {
        setEntries((current) =>
          editingId
            ? current.map((entry) => entry.id === editingId ? saved : entry)
            : [...current, saved]
        );
      } else {
        changeDate(saved.date);
      }
      setDialogOpen(false);
      setLoadError("");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(entry: ScheduleEntry) {
    if (!window.confirm("Delete schedule " + entry.jobNo + "? This cannot be undone.")) return;
    try {
      await apiRequest<{ success: true }>("/api/schedules/" + encodeURIComponent(entry.id), {
        method: "DELETE",
      });
      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to delete schedule.");
    }
  }

  return (
    <main className="mx-auto max-w-[1500px] px-5 pb-16 pt-9 sm:px-8 lg:px-10 lg:pt-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] sm:text-[32px]">
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
            disabled={!selectedDate || loading || entries.length === 0 || exporting}
            title="Export all jobs for the selected date to Excel"
          >
            <Download className="size-4" />
            {exporting ? "Exporting..." : "Export to Excel"}
          </Button>
          <Button
            className="h-10 px-4"
            onClick={openNew}
            disabled={!selectedDate || loading || catalogLoading || !!catalogError}
          >
            <Plus className="size-4" />
            Add Schedule
          </Button>
        </div>
      </div>

      {(loadError || catalogError || exportError) && (
        <div role="alert" className="mb-4 space-y-1 text-sm text-destructive">
          {loadError && <p>{loadError}</p>}
          {catalogError && <p>{catalogError}</p>}
          {exportError && <p>{exportError}</p>}
        </div>
      )}

      <section className="rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">{dateLabel(selectedDate)}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {loading ? "Loading jobs..." : entries.length + (entries.length === 1 ? " job scheduled" : " jobs scheduled")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous day"
              disabled={!selectedDate}
              onClick={() => changeDate(shiftDate(selectedDate, -1))}
            >
              <ChevronLeft />
            </Button>
            <Input
              type="date"
              aria-label="Schedule date"
              value={selectedDate}
              onChange={(event) => changeDate(event.target.value)}
              className="w-[154px] sm:w-[168px]"
            />
            <Button
              size="icon"
              variant="outline"
              aria-label="Next day"
              disabled={!selectedDate}
              onClick={() => changeDate(shiftDate(selectedDate, 1))}
            >
              <ChevronRight />
            </Button>
            <Button size="sm" variant="outline" className="ml-1" onClick={() => changeDate(dateKey(new Date()))}>
              Today
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Schedule overview</p>
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
              <TableHead className="w-[90px] pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visibleEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="pl-6 font-medium">{entry.jobNo}</TableCell>
                <TableCell className="font-medium">{entry.projectName}</TableCell>
                <TableCell className="text-[#545b64]">{entry.clientName}</TableCell>
                <TableCell className="whitespace-pre-wrap text-[#545b64]">{entry.labours || "—"}</TableCell>
                <TableCell className="whitespace-pre-wrap text-[#545b64]">{entry.equipment || "—"}</TableCell>
                <TableCell>
                  <span className="font-medium">{timeLabel(entry.timeIn)}</span>
                  <span className="mx-1.5 text-muted-foreground">–</span>
                  <span className="font-medium">{timeLabel(entry.timeOut)}</span>
                </TableCell>
                <TableCell className="max-w-[330px] whitespace-pre-wrap text-[#545b64]">{entry.scope}</TableCell>
                <TableCell className="pr-5">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={"Edit " + entry.jobNo} onClick={() => openEdit(entry)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={"Delete " + entry.jobNo} onClick={() => deleteEntry(entry)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(loading || visibleEntries.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-20 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-[#f3f5f7] text-[#6b7280]">
                      <ClipboardList className="size-5" />
                    </div>
                    <h3 className="text-sm font-semibold">
                      {loading ? "Loading schedules..." : query ? "No matching schedules" : "No jobs scheduled"}
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {loading ? "Retrieving data from PostgreSQL." : query ? "Try another search term." : "Add a job for this date."}
                    </p>
                    {!loading && !query && !loadError && (
                      <Button variant="outline" size="sm" className="mt-5"
                        disabled={catalogLoading || !!catalogError} onClick={openNew}>
                        <Plus /> Add a job
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <div className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
          Showing {loading ? 0 : visibleEntries.length} of {entries.length} scheduled {entries.length === 1 ? "job" : "jobs"}.
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!saving) setDialogOpen(next); }}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit schedule" : "Add schedule"}</DialogTitle>
            <DialogDescription>
              Select a project and assign employees, equipment, working hours, and scope.
            </DialogDescription>
          </DialogHeader>
          <form className="mt-1 space-y-5" onSubmit={saveEntry}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="schedule-date">Schedule Date *</Label>
                <Input
                  id="schedule-date" type="date" required value={draft.date}
                  onChange={(event) => updateDraft("date", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job-no">Job No *</Label>
                <Input
                  id="job-no" required maxLength={200} placeholder="e.g. G-SO-26-00001"
                  value={draft.jobNo} onChange={(event) => updateDraft("jobNo", event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="project-id">Project *</Label>
                  <Link className="text-xs text-muted-foreground underline hover:text-foreground" href="/projects">
                    Manage projects
                  </Link>
                </div>
                <select
                  id="project-id"
                  required
                  value={draft.projectId}
                  onChange={(event) => updateDraft("projectId", event.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20"
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} — {project.clientName}
                    </option>
                  ))}
                </select>
                {projects.length === 0 && (
                  <p className="text-xs text-muted-foreground">Create a project on the Projects page first.</p>
                )}
                {selectedProject && (
                  <p className="text-xs text-muted-foreground">Client: {selectedProject.clientName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-in">Time In *</Label>
                <Input
                  id="time-in" type="time" required value={draft.timeIn}
                  onChange={(event) => updateDraft("timeIn", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-out">Time Out *</Label>
                <Input
                  id="time-out" type="time" required value={draft.timeOut}
                  onChange={(event) => updateDraft("timeOut", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Labours / Employees</Label>
                  <Link className="text-xs text-muted-foreground underline" href="/employees">Manage</Link>
                </div>
                <div className="max-h-40 min-h-20 space-y-2 overflow-y-auto rounded-md border border-input p-3">
                  {employees.length === 0 && <p className="text-xs text-muted-foreground">No employees available.</p>}
                  {employees.map((employee) => (
                    <label key={employee.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5 accent-[#20262e]"
                        checked={draft.employeeIds.includes(employee.id)}
                        onChange={(event) => toggleResource("employeeIds", employee.id, event.target.checked)}
                      />
                      <span>{employee.name}{employee.trade ? <span className="text-muted-foreground"> · {employee.trade}</span> : null}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Equipment</Label>
                  <Link className="text-xs text-muted-foreground underline" href="/equipments">Manage</Link>
                </div>
                <div className="max-h-40 min-h-20 space-y-2 overflow-y-auto rounded-md border border-input p-3">
                  {equipments.length === 0 && <p className="text-xs text-muted-foreground">No equipment available.</p>}
                  {equipments.map((equipment) => (
                    <label key={equipment.id} className="flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-0.5 accent-[#20262e]"
                        checked={draft.equipmentIds.includes(equipment.id)}
                        onChange={(event) => toggleResource("equipmentIds", equipment.id, event.target.checked)}
                      />
                      <span>{equipment.name}{equipment.category ? <span className="text-muted-foreground"> · {equipment.category}</span> : null}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Scope *</Label>
              <Textarea
                id="scope" required maxLength={5000} rows={3}
                placeholder="Describe the planned site activity..."
                value={draft.scope} onChange={(event) => updateDraft("scope", event.target.value)}
              />
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || projects.length === 0}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
