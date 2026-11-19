"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Plus, Save } from "lucide-react";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { ResourceChecklist, type PlanningResourceOption } from "@/components/resource-checklist";
import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import type { TableSortDirection } from "@/components/ui/sortable-table-head";
import { compareTableValues } from "@/lib/table-sort";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project, Employee, Equipment } from "@/lib/catalog";
import { emptyDispatch, scopeOptions, type DispatchEntry, type DispatchSheet } from "@/lib/dispatch";
import { apiRequest } from "@/lib/http";
import { dateKey, dateLabel } from "@/lib/schedule";

type AssignmentSlot = { key: string; resourceId: string };
type SlotField = "foremanSlots" | "labourSlots" | "equipmentSlots";
type EditorSortKey = "original" | "job" | "foremen" | "labours" | "equipment" | "shift" | "scope" | "time";
type EditorRow = Omit<DispatchEntry, "foremanIds" | "employeeIds" | "equipmentIds"> & {
  key: string;
  foremanSlots: AssignmentSlot[];
  labourSlots: AssignmentSlot[];
  equipmentSlots: AssignmentSlot[];
};

const assignmentLimits: Record<SlotField, number> = {
  foremanSlots: 60,
  labourSlots: 150,
  equipmentSlots: 100,
};

function assignmentSlot(resourceId = ""): AssignmentSlot {
  return { key: crypto.randomUUID(), resourceId };
}

function isSiteForeman(designation: string): boolean {
  return designation.trim().replace(/[\s_-]+/g, " ").toLowerCase() === "site foreman";
}

function newRow(): EditorRow {
  const draft = emptyDispatch();
  return {
    key: crypto.randomUUID(),
    projectId: draft.projectId,
    foremanSlots: [],
    labourSlots: [],
    equipmentSlots: [],
    shift: draft.shift,
    scope: draft.scope,
    campStart: draft.campStart,
    timeIn: draft.timeIn,
    timeOut: draft.timeOut,
  };
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}
    className="h-9 w-full min-w-0 rounded-md border border-input bg-white px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
    {children}
  </select>;
}

export function ScheduleEditor({ sheetId }: { sheetId?: string }) {
  const router = useRouter();
  const [date, setDate] = React.useState("");
  const [rows, setRows] = React.useState<EditorRow[]>(() => [newRow()]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<string | null>(null);
  // A single resource panel edits the selected job; job cards never own extra pickers.
  const [activeJobKey, setActiveJobKey] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<{ key: EditorSortKey; direction: TableSortDirection }>({
    key: "original", direction: "asc",
  });

  React.useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Project[]>("/api/projects"),
      apiRequest<Employee[]>("/api/employees"),
      apiRequest<Equipment[]>("/api/equipments"),
      sheetId ? apiRequest<DispatchSheet>("/api/schedules/" + encodeURIComponent(sheetId)) : Promise.resolve(null),
    ]).then(([p, e, equipment, sheet]) => {
      if (!active) return;
      setProjects(p); setEmployees(e); setEquipments(equipment);
      if (sheet) {
        setDate(sheet.date);
        setRows(sheet.jobs.map((r) => ({
          key: r.id || crypto.randomUUID(),
          id: r.id,
          projectId: r.projectId,
          foremanSlots: r.foremanIds.map((id) => assignmentSlot(id)),
          labourSlots: r.employeeIds.map((id) => assignmentSlot(id)),
          equipmentSlots: r.equipmentIds.map((id) => assignmentSlot(id)),
          shift: r.shift,
          scope: r.scope,
          campStart: r.campStart || "06:00",
          timeIn: r.timeIn,
          timeOut: r.timeOut,
        })));
      } else { setDate(dateKey(new Date())); }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load schedule.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sheetId]);

  function patch<Key extends Exclude<keyof DispatchEntry, "foremanIds" | "employeeIds" | "equipmentIds">>(key: string, field: Key, value: DispatchEntry[Key]) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
    setError("");
  }

  function toggleAssignment(rowKey: string, field: SlotField, resourceId: string, checked: boolean) {
    setRows((current) => current.map((row) => {
      if (row.key !== rowKey) return row;
      // A checkbox represents one unique assignment, and a resource may be used
      // on a second job if the planner approves it.
      const assigned = row[field].filter((slot) => slot.resourceId);
      if (checked) {
        if (assigned.some((slot) => slot.resourceId === resourceId) ||
          assigned.length >= assignmentLimits[field]) return row;
        return { ...row, [field]: [...assigned, assignmentSlot(resourceId)] };
      }
      return { ...row, [field]: assigned.filter((slot) => slot.resourceId !== resourceId) };
    }));
    setError("");
  }

  function selectedIds(row: EditorRow, field: SlotField): string[] {
    return row[field].map((slot) => slot.resourceId).filter(Boolean);
  }

  function sortBy(key: EditorSortKey) {
    setSort((previous) => ({
      key,
      direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  }

  function duplicateJob(rowKey: string) {
    if (saving) return;
    const cloneKey = crypto.randomUUID();
    setRows((current) => current.flatMap((row) => {
      if (row.key !== rowKey) return [row];
      return [row, {
        ...row,
        id: undefined,
        key: cloneKey,
        foremanSlots: row.foremanSlots.map((slot) => assignmentSlot(slot.resourceId)),
        labourSlots: row.labourSlots.map((slot) => assignmentSlot(slot.resourceId)),
        equipmentSlots: row.equipmentSlots.map((slot) => assignmentSlot(slot.resourceId)),
      }];
    }));
    setActiveJobKey(cloneKey);
    setError("");
  }

  function addJob() {
    if (loading || saving) return;
    const next = newRow();
    setRows((current) => [...current, next]);
    setActiveJobKey(next.key);
    setError("");
  }

  // A sorted table is only a view over rows: saving/exporting preserve original
  // schedule job order and every selector remains attached to its stable row key.
  const displayedRows = rows.map((row, index) => ({ row, index }));
  const activeRow = rows.find((row) => row.key === activeJobKey) ?? rows[0] ?? null;
  const activeIndex = activeRow ? rows.findIndex((row) => row.key === activeRow.key) : -1;
  const activeProject = activeRow ? projects.find((project) => project.id === activeRow.projectId) : undefined;
  if (sort.key !== "original" || sort.direction === "desc") {
    const sortValue = (row: EditorRow, index: number): string | number => {
      switch (sort.key) {
        case "original": return index;
        case "job": {
          const project = projects.find((item) => item.id === row.projectId);
          return project?.jobNo || project?.name || "";
        }
        case "foremen": return row.foremanSlots.filter((slot) => slot.resourceId).length;
        case "labours": return row.labourSlots.filter((slot) => slot.resourceId).length;
        case "equipment": return row.equipmentSlots.filter((slot) => slot.resourceId).length;
        case "shift": return row.shift;
        case "scope": return row.scope;
        case "time": return row.timeIn;
      }
    };
    displayedRows.sort((a, b) =>
      compareTableValues(sortValue(a.row, a.index), sortValue(b.row, b.index), sort.direction) ||
      a.index - b.index
    );
  }

  const projectOptions: ComboboxOption[] = projects.map((project) => ({
    value: project.id,
    label: (project.jobNo || "No Job No.") + " — " + (project.name || "Unnamed Project"),
    description: "SO No: " + (project.soNo || "—") + " · Job No: " +
      (project.jobNo || "—") + " · " + (project.clientName || "No client"),
    searchText: [project.jobNo, project.soNo, project.name, project.clientName].filter(Boolean).join(" "),
  }));

  const employeeOptions: ComboboxOption[] = employees.map((employee) => ({
    value: employee.id,
    label: employee.name || employee.employeeCode || "Unnamed Employee",
    description: [employee.employeeCode, employee.designation].filter(Boolean).join(" · "),
    searchText: [employee.name, employee.employeeCode, employee.designation].filter(Boolean).join(" "),
  }));

  // This is a role-specific picker, not a subset inferred from employee names.
  const siteForemanIds = new Set(employees.filter((employee) =>
    isSiteForeman(employee.designation)
  ).map((employee) => employee.id));
  const foremanOptions = employeeOptions.filter((option) => siteForemanIds.has(option.value));

  const equipmentOptions: ComboboxOption[] = equipments.map((equipment) => ({
    value: equipment.id,
    label: equipment.vehicleDetails || equipment.registrationNo || "Unnamed Equipment",
    description: [equipment.registrationNo, equipment.vehicleType].filter(Boolean).join(" · "),
    searchText: [equipment.registrationNo, equipment.vehicleDetails, equipment.vehicleType]
      .filter(Boolean).join(" "),
  }));

  function renderResourceList(
    row: EditorRow,
    index: number,
    field: SlotField,
    title: "Foremen" | "Labourers" | "Equipment",
    options: ComboboxOption[],
    emptyHint: string,
  ) {
    const chosen = selectedIds(row, field);
    const known = new Set(options.map((item) => item.value));
    const enriched: PlanningResourceOption[] = options.map((option) => ({
      ...option,
      otherJobs: rows.flatMap((other, otherIndex) =>
        other.key !== row.key && other[field].some((slot) => slot.resourceId === option.value)
          ? [otherIndex + 1] : []
      ),
    }));
    // Keep stale assignments visible and removable. They must never disappear
    // silently when a Site Foreman's designation changes or a record is deleted.
    for (const id of chosen) {
      if (known.has(id)) continue;
      const employee = employees.find((item) => item.id === id);
      const equipment = equipments.find((item) => item.id === id);
      enriched.push({
        value: id,
        label: employee?.name || equipment?.vehicleDetails || "Unknown resource (" + id + ")",
        description: field === "foremanSlots" && employee
          ? "Designation: " + (employee.designation || "not set") + " · Site Foreman required"
          : "Resource is no longer eligible or available in the directory",
        searchText: [employee?.employeeCode, equipment?.registrationNo, id].filter(Boolean).join(" "),
        invalid: true,
      });
    }
    return (
      <ResourceChecklist
        title={title}
        jobNumber={index + 1}
        options={enriched}
        selectedIds={chosen}
        onToggle={(resourceId, checked) => toggleAssignment(row.key, field, resourceId, checked)}
        maxSelected={assignmentLimits[field]}
        disabled={loading || saving}
        emptyHint={emptyHint}
        compact
      />
    );
  }

  async function save() {
    if (saving || loading) return;
    if (!date) { setError("Select a date."); return; }
    if (!rows.length) { setError("Add at least one dispatch row."); return; }
    const invalid = rows.findIndex((r) => !r.projectId || !r.scope.trim() || !r.campStart || !r.timeIn || !r.timeOut);
    if (invalid >= 0) { setError("Row " + (invalid + 1) + ": select job and scope, and fill out all three times."); return; }
    const missingLabour = rows.findIndex((r) => selectedIds(r, "labourSlots").length === 0);
    if (missingLabour >= 0) {
      setError("Row " + (missingLabour + 1) + ": select at least one labour.");
      return;
    }
    const missingForeman = rows.findIndex((r) => selectedIds(r, "foremanSlots").length === 0);
    if (missingForeman >= 0) {
      setError("Row " + (missingForeman + 1) + ": select at least one foreman.");
      return;
    }
    const wrongForeman = rows.findIndex((r) => selectedIds(r, "foremanSlots")
      .some((id) => !siteForemanIds.has(id)));
    if (wrongForeman >= 0) {
      setError("Row " + (wrongForeman + 1) + ": select an employee designated as Site Foreman.");
      return;
    }
    const missingEquipment = rows.findIndex((r) => selectedIds(r, "equipmentSlots").length === 0);
    if (missingEquipment >= 0) {
      setError("Row " + (missingEquipment + 1) + ": select at least one equipment item.");
      return;
    }
    setSaving(true); setError("");
    try {
      const payload = { date, jobs: rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        projectId: r.projectId, foremanIds: selectedIds(r, "foremanSlots"),
        employeeIds: selectedIds(r, "labourSlots"),
        equipmentIds: selectedIds(r, "equipmentSlots"), shift: r.shift, scope: r.scope.trim(),
        campStart: r.campStart, timeIn: r.timeIn, timeOut: r.timeOut,
      })) };
      await apiRequest<DispatchSheet>(sheetId ? "/api/schedules/" + encodeURIComponent(sheetId) : "/api/schedules", {
        method: sheetId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.push("/schedules");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save schedule.");
    } finally { setSaving(false); }
  }

  async function exportExcel() {
    if (exporting || !date || !rows.length) return;
    setExporting(true); setError("");
    try {
      const { exportDispatchSheet } = await import("@/lib/export-dispatch-sheet");
      await exportDispatchSheet(
        date,
        rows.map((row) => ({
          ...row,
          foremanIds: selectedIds(row, "foremanSlots"),
          employeeIds: selectedIds(row, "labourSlots"),
          equipmentIds: selectedIds(row, "equipmentSlots"),
        })),
        projects,
        employees,
        equipments
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setExporting(false); }
  }

  return (
    <main className="w-full min-w-0 max-w-none px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10">
      <Link href="/schedules" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to schedules
      </Link>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div>
          <p className="technical-eyebrow mb-1.5">OPERATIONS / SCHEDULES / DISPATCH</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-primary">{sheetId ? "Edit Schedule" : "Create Schedule"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan each job with searchable, scrollable Foremen, Labourers and Equipment lists.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button className="w-full sm:w-auto" variant="outline" disabled={loading || exporting || rows.length === 0} onClick={exportExcel}>
            <Download /> {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button className="w-full sm:w-auto" disabled={loading || saving || rows.length === 0} onClick={save}>
            <Save /> {saving ? "Saving..." : sheetId ? "Save Changes" : "Create Schedule"}
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 items-center gap-4 rounded-xl border bg-white px-3 py-4 sm:flex sm:flex-wrap sm:gap-8 sm:px-5">
        <div className="space-y-1.5">
          <Label htmlFor="dispatch-date">Schedule Date</Label>
          <Input id="dispatch-date" type="date" value={date} disabled={loading || saving}
            onChange={(event) => setDate(event.target.value)} className="w-full sm:w-48" />
        </div>
        <div><p className="text-xs text-muted-foreground">Date</p>
          <p className="mt-1 text-sm font-medium">{date ? dateLabel(date) : "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Jobs</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{new Set(rows.map((r) => r.projectId).filter(Boolean)).size}</p></div>
        <div><p className="text-xs text-muted-foreground">Team dispatches</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{rows.length}</p></div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <section className="min-w-0">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-border bg-white px-4 py-4 sm:flex-row sm:items-center sm:px-5">
          <div>
            <h2 className="text-base font-semibold text-primary">Daily job planning</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a job on the left, then assign foremen, labourers and equipment using the shared resource panel on the right.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label htmlFor="job-sort-key" className="text-xs font-medium text-muted-foreground">Sort jobs</label>
            <select
              id="job-sort-key"
              value={sort.key}
              onChange={(event) => setSort({ key: event.target.value as EditorSortKey, direction: "asc" })}
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm text-foreground sm:flex-none"
            >
              <option value="original">Original order</option>
              <option value="job">Job No / Project</option>
              <option value="foremen">Foremen count</option>
              <option value="labours">Labour count</option>
              <option value="equipment">Equipment count</option>
              <option value="shift">Shift</option>
              <option value="scope">Scope</option>
              <option value="time">Work start time</option>
            </select>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title={"Sort " + (sort.direction === "asc" ? "descending" : "ascending")}
              aria-label={"Sort jobs " + (sort.direction === "asc" ? "descending" : "ascending")}
              onClick={() => sortBy(sort.key)}
            >
              {sort.direction === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
            </Button>
            <Button
              variant="outline"
              className="h-9"
              disabled={loading || saving}
              onClick={addJob}
            >
              <Plus className="size-4" /> Add Job
            </Button>
          </div>
        </div>

        {loading && (
          <div className="rounded-xl border border-border bg-white px-4 py-12 text-center text-sm text-muted-foreground">
            Loading schedule and resources...
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="rounded-xl border border-border bg-white px-4 py-12 text-center">
            <p className="text-sm font-medium text-primary">No jobs in this schedule</p>
            <p className="mt-1 text-xs text-muted-foreground">Add a job to start assigning your team and equipment.</p>
            <Button variant="outline" className="mt-4" onClick={addJob}>
              <Plus className="size-4" /> Add Job
            </Button>
          </div>
        )}

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,1fr)]">
          <div className="min-w-0 space-y-4">
          {!loading && displayedRows.map(({ row, index }) => {
            const customScope = !!row.scope && !scopeOptions.some((scope) => scope === row.scope);
            const selectedProject = projects.find((project) => project.id === row.projectId);
            const assignedCount =
              selectedIds(row, "foremanSlots").length +
              selectedIds(row, "labourSlots").length +
              selectedIds(row, "equipmentSlots").length;
            const selected = activeRow?.key === row.key;
            return (
              <section
                key={row.key}
                aria-labelledby={"dispatch-job-" + row.key}
                className={"min-w-0 rounded-xl border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)] transition-colors " +
                  (selected ? "border-[#365F91] ring-1 ring-[#365F91]/25" : "border-border")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-[#F8FAFD] px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="technical-eyebrow">JOB {String(index + 1).padStart(2, "0")} / DISPATCH</p>
                    <h3 id={"dispatch-job-" + row.key} className="mt-1 break-words text-base font-semibold text-primary">
                      {selectedProject?.name || "Select project"}
                    </h3>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {selectedProject?.jobNo || "Job No not selected"} · {selectedProject?.clientName || "Client not selected"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {assignedCount} assigned
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? "secondary" : "outline"}
                      className="h-8"
                      aria-pressed={selected}
                      aria-label={"Assign resources to job " + (index + 1)}
                      onClick={() => setActiveJobKey(row.key)}
                    >
                      {selected ? "Selected job" : "Select job"}
                    </Button>
                    <RowActionsMenu
                      itemName={"dispatch job " + (index + 1)}
                      onDuplicate={() => duplicateJob(row.key)}
                      onDelete={() => setRemoveTarget(row.key)}
                      deleteLabel="Remove job"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="grid min-w-0 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                  <div className="min-w-0 space-y-4">
                    <div className="min-w-0 space-y-2">
                      <Label>Project / Job No *</Label>
                      <SearchCombobox
                        label={"Project for dispatch job " + (index + 1)}
                        value={row.projectId}
                        onValueChange={(value) => patch(row.key, "projectId", value)}
                        options={projectOptions}
                        placeholder="Search Job No, SO No or project name..."
                        disabled={saving}
                      />
                      {projects.length === 0 && (
                        <Link href="/projects" className="block text-xs text-[#365F91] underline">
                          Add or import projects first
                        </Link>
                      )}
                      {selectedProject && (
                        <p className="break-words text-xs leading-5 text-muted-foreground">
                          SO: {selectedProject.soNo || "—"} · {selectedProject.clientName || "Client not specified"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Scope of work *</Label>
                      <SelectField
                        label={"Scope of work for job " + (index + 1)}
                        value={customScope ? "__other__" : row.scope}
                        onChange={(value) => patch(row.key, "scope", value === "__other__" ? "Other" : value)}
                      >
                        <option value="">Select scope...</option>
                        {scopeOptions.map((scope) => <option value={scope} key={scope}>{scope}</option>)}
                        <option value="__other__">Other (specify)</option>
                      </SelectField>
                      {customScope && (
                        <Input
                          aria-label={"Custom scope for job " + (index + 1)}
                          placeholder="Describe scope of work..."
                          maxLength={200}
                          value={row.scope}
                          onChange={(event) => patch(row.key, "scope", event.target.value)}
                        />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 space-y-3">
                    <div className="space-y-2">
                      <Label>Shift *</Label>
                      <SelectField
                        label={"Shift for job " + (index + 1)}
                        value={row.shift}
                        onChange={(value) => patch(row.key, "shift", value as DispatchEntry["shift"])}
                      >
                        <option value="Day">Day shift</option>
                        <option value="Night">Night shift</option>
                      </SelectField>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                      {([
                        ["campStart", "Camp start"],
                        ["timeIn", "Work start"],
                        ["timeOut", "Work end"],
                      ] as const).map(([field, label]) => (
                        <div key={field} className="min-w-0 space-y-1.5">
                          <Label htmlFor={row.key + field} className="text-xs">{label} *</Label>
                          <Input
                            id={row.key + field}
                            type="time"
                            value={row[field]}
                            onChange={(event) => patch(row.key, field, event.target.value)}
                            className="h-9 min-w-0 px-2 text-sm tabular-nums"
                            disabled={saving}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-border bg-[#FCFDFE] px-4 py-4 sm:px-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-primary">Assigned resources</h4>
                    <span className="text-xs text-muted-foreground">
                      {selected ? "Manage in the resource panel →" : "Select this job to change assignments"}
                    </span>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                    {([
                      ["Foremen", "foremanSlots", foremanOptions],
                      ["Labourers", "labourSlots", employeeOptions],
                      ["Equipment", "equipmentSlots", equipmentOptions],
                    ] as const).map(([title, field, options]) => {
                      const ids = selectedIds(row, field);
                      return (
                        <div key={field} className="min-w-0 rounded-lg border border-border bg-white p-3">
                          <p className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold text-[#365F91]">
                            <span>{title}</span>
                            <span className="font-mono tabular-nums text-muted-foreground">{ids.length}</span>
                          </p>
                          {ids.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Not assigned</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {ids.slice(0, 5).map((id) => (
                                <li key={id} className="break-words text-xs leading-5 text-foreground">
                                  {options.find((option) => option.value === id)?.label ||
                                    employees.find((person) => person.id === id)?.name ||
                                    equipments.find((equipment) => equipment.id === id)?.vehicleDetails ||
                                    "Unknown resource"}
                                </li>
                              ))}
                              {ids.length > 5 && (
                                <li className="text-xs text-muted-foreground">+{ids.length - 5} more</li>
                              )}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
          </div>
          <aside
            aria-label="Shared resource assignments"
            className="min-w-0 self-start rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)] lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain"
          >
            <div className="sticky top-0 z-10 border-b border-border bg-[#F8FAFD] px-3 py-3">
              <p className="technical-eyebrow">PLANNING / RESOURCES</p>
              <h3 className="mt-1 text-sm font-semibold text-primary">Resource Assignments</h3>
              {activeRow ? (
                <div className="mt-2 min-w-0">
                  <p className="font-mono text-[11px] text-[#365F91]">JOB {String(activeIndex + 1).padStart(2, "0")}</p>
                  <p className="mt-0.5 break-words text-xs font-medium text-primary">
                    {activeProject?.name || "Select a project"}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                    Checking resources below updates only this job.
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Add a job to assign resources.</p>
              )}
            </div>
            {activeRow ? (
              <div className="space-y-3 p-2.5">
                {renderResourceList(
                  activeRow, activeIndex, "foremanSlots", "Foremen", foremanOptions,
                  "No Site Foremen in the employee directory. Designation must be Site Foreman.",
                )}
                {renderResourceList(
                  activeRow, activeIndex, "labourSlots", "Labourers", employeeOptions,
                  "No employees in the directory. Add or import labourers first.",
                )}
                {renderResourceList(
                  activeRow, activeIndex, "equipmentSlots", "Equipment", equipmentOptions,
                  "No equipment in the directory. Add or import equipment first.",
                )}
              </div>
            ) : (
              <p className="p-4 text-xs text-muted-foreground">No job selected.</p>
            )}
          </aside>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3">
          <p className="text-xs leading-5 text-muted-foreground">
            All times use 24-hour format. Night shifts can finish the next morning.
            Sorting changes display order only; saved order and Excel export order are unchanged.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || saving}
            onClick={addJob}
          >
            <Plus className="size-4" /> Add Job
          </Button>
        </div>
      </section>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" asChild><Link href="/schedules">Cancel</Link></Button>
        <Button onClick={save} disabled={loading || saving || rows.length === 0}>
          <Save /> {saving ? "Saving..." : sheetId ? "Save Changes" : "Create Schedule"}
        </Button>
      </div>

      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open && !saving) setRemoveTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove job</DialogTitle>
            <DialogDescription>
              Remove this job and its assigned foremen, labourers, and equipment from
              the current schedule? This change is saved when you save the schedule.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" type="button" onClick={() => {
              setRows((current) => current.filter((row) => row.key !== removeTarget));
              setActiveJobKey((current) => current === removeTarget ? null : current);
              setRemoveTarget(null);
              setError("");
            }}>
              Remove job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
