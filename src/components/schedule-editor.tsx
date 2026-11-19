"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Plus, Save, X } from "lucide-react";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { ResourceChecklist, type PlanningResourceOption } from "@/components/resource-checklist";
import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Project, Employee, Equipment } from "@/lib/catalog";
import { emptyDispatch, type DispatchEntry, type DispatchSheet } from "@/lib/dispatch";
import { apiRequest } from "@/lib/http";
import { dateKey, dateLabel } from "@/lib/schedule";

type AssignmentSlot = { key: string; resourceId: string };
type SlotField = "foremanSlots" | "labourSlots" | "equipmentSlots";
type ResourceTab = "foremen" | "labours" | "equipments";
type ResourceDrag = { field: SlotField; resourceId: string };
const RESOURCE_DRAG_TYPE = "application/x-daily-schedule-resource";

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
    dailyTarget: draft.dailyTarget,
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
  const [resourceTab, setResourceTab] = React.useState<ResourceTab>("foremen");
  const [dragging, setDragging] = React.useState<ResourceDrag | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ rowKey: string; field: SlotField } | null>(null);

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
          dailyTarget: r.dailyTarget ?? "",
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

  function isEligible(field: SlotField, resourceId: string): boolean {
    if (field === "equipmentSlots") return equipments.some((equipment) => equipment.id === resourceId);
    return employees.some((employee) =>
      employee.id === resourceId &&
      (field === "labourSlots" || isSiteForeman(employee.designation))
    );
  }

  function assignedJobs(field: SlotField, resourceId: string): number[] {
    return rows.flatMap((row, index) => {
      const exists = field === "equipmentSlots"
        ? row.equipmentSlots.some((slot) => slot.resourceId === resourceId)
        : row.foremanSlots.some((slot) => slot.resourceId === resourceId) ||
          row.labourSlots.some((slot) => slot.resourceId === resourceId);
      return exists ? [index + 1] : [];
    });
  }

  function assignResource(rowKey: string, field: SlotField, resourceId: string) {
    if (loading || saving) return;
    if (!isEligible(field, resourceId)) {
      setError("This resource is no longer eligible for the selected category.");
      return;
    }
    const target = rows.find((row) => row.key === rowKey);
    if (!target) return;
    const otherAssignments = assignedJobs(field, resourceId);
    if (otherAssignments.length > 0) {
      setError("Resource already assigned to Job " + otherAssignments.join(", ") +
        ". Remove the assignment there before using it on another job.");
      return;
    }
    if (target[field].filter((slot) => slot.resourceId).length >= assignmentLimits[field]) {
      setError("The selected job has reached its " + field.replace("Slots", "") + " assignment limit.");
      return;
    }
    setRows((current) => current.map((row) =>
      row.key === rowKey
        ? { ...row, [field]: [...row[field].filter((slot) => slot.resourceId), assignmentSlot(resourceId)] }
        : row
    ));
    setActiveJobKey(rowKey);
    setError("");
  }

  function unassignResource(rowKey: string, field: SlotField, resourceId: string) {
    if (loading || saving) return;
    setRows((current) => current.map((row) =>
      row.key === rowKey
        ? { ...row, [field]: row[field].filter((slot) => slot.resourceId !== resourceId) }
        : row
    ));
    setError("");
  }

  function startResourceDrag(
    event: React.DragEvent<HTMLButtonElement>,
    field: SlotField,
    resourceId: string,
  ) {
    if (loading || saving || !isEligible(field, resourceId) || assignedJobs(field, resourceId).length) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(RESOURCE_DRAG_TYPE, JSON.stringify({ field, resourceId }));
    setDragging({ field, resourceId });
    setDropTarget(null);
  }

  function stopResourceDrag() {
    setDragging(null);
    setDropTarget(null);
  }

  function dropResource(event: React.DragEvent<HTMLElement>, rowKey: string, field: SlotField) {
    event.preventDefault();
    const payload = event.dataTransfer.getData(RESOURCE_DRAG_TYPE);
    stopResourceDrag();
    try {
      const parsed: unknown = JSON.parse(payload);
      if (!parsed || typeof parsed !== "object") return;
      const candidate = parsed as Record<string, unknown>;
      if (candidate.field !== field || typeof candidate.resourceId !== "string") return;
      // The drop payload is not trusted; eligibility, uniqueness and limits are
      // checked again against the active resource directory and job assignments.
      assignResource(rowKey, field, candidate.resourceId);
    } catch {
      // Ignore unsupported drops from other pages and applications.
    }
  }

  function selectedIds(row: EditorRow, field: SlotField): string[] {
    return row[field].map((slot) => slot.resourceId).filter(Boolean);
  }

  function onResourceTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, tab: ResourceTab) {
    const tabs: ResourceTab[] = ["foremen", "labours", "equipments"];
    const current = tabs.indexOf(tab);
    let next: ResourceTab | undefined;
    if (event.key === "ArrowRight") next = tabs[(current + 1) % tabs.length];
    if (event.key === "ArrowLeft") next = tabs[(current - 1 + tabs.length) % tabs.length];
    if (event.key === "Home") next = tabs[0];
    if (event.key === "End") next = tabs[tabs.length - 1];
    if (!next) return;
    event.preventDefault();
    setResourceTab(next);
    document.getElementById("resource-tab-" + next)?.focus();
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
        // Duplicate the job plan but not its resources. A resource can only
        // be assigned once within the current daily schedule.
        foremanSlots: [],
        labourSlots: [],
        equipmentSlots: [],
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

  // Job order is the original schedule order. Drag-and-drop assigns resources,
  // never moves or reorders the jobs.
  const displayedRows = rows.map((row, index) => ({ row, index }));
  const activeRow = rows.find((row) => row.key === activeJobKey) ?? rows[0] ?? null;
  const activeIndex = activeRow ? rows.findIndex((row) => row.key === activeRow.key) : -1;

  const projectOptions: ComboboxOption[] = projects.map((project) => {
    const projectName = (project.name || "").trim();
    const hasName = !!projectName && !/^unnamed project$/i.test(projectName);
    const jobNo = project.jobNo?.trim() || "No Job No.";
    const clientName = project.clientName?.trim() || "Client not specified";
    const soNo = project.soNo?.trim() || "—";
    return {
      value: project.id,
      label: jobNo + " — " + (hasName ? projectName : clientName),
      searchText: [project.jobNo, project.soNo, project.name, project.clientName].filter(Boolean).join(" "),
      project: { jobNo, projectName, clientName, soNo, hasName },
    };
  });

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
    label: [equipment.fleet, equipment.description || equipment.vehicleDetails].filter(Boolean).join(" — ") ||
      equipment.registrationNo || "Unnamed Equipment",
    // Equipment prices belong in the Equipment register, not in assignment cards.
    searchText: [
      equipment.fleet, equipment.description, equipment.registrationNo,
      equipment.vehicleDetails, equipment.vehicleType,
    ].filter(Boolean).join(" "),
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
      assignedJobs: assignedJobs(field, option.value),
    }));
    // Keep stale assignments visible and removable. They must never disappear
    // silently when a Site Foreman's designation changes or a record is deleted.
    for (const id of chosen) {
      if (known.has(id)) continue;
      const employee = employees.find((item) => item.id === id);
      const equipment = equipments.find((item) => item.id === id);
      enriched.push({
        value: id,
        label: employee?.name || equipment?.description || equipment?.fleet || equipment?.vehicleDetails || "Unknown resource (" + id + ")",
        description: field === "foremanSlots" && employee
          ? "Designation: " + (employee.designation || "not set") + " · Site Foreman required"
          : "Resource is no longer eligible or available in the directory",
        searchText: [employee?.employeeCode, equipment?.fleet, equipment?.registrationNo, id].filter(Boolean).join(" "),
        invalid: true,
        assignedJobs: assignedJobs(field, id),
      });
    }
    return (
      <ResourceChecklist
        title={title}
        jobNumber={index + 1}
        options={enriched}
        onAssign={(resourceId) => assignResource(row.key, field, resourceId)}
        onDragStart={(event, resourceId) => startResourceDrag(event, field, resourceId)}
        onDragEnd={stopResourceDrag}
        disabled={loading || saving}
        emptyHint={emptyHint}
        fillHeight
      />
    );
  }

  async function save() {
    if (saving || loading) return;
    if (!date) { setError("Select a date."); return; }
    if (!rows.length) { setError("Add at least one dispatch row."); return; }
    const invalid = rows.findIndex((r) => !r.projectId || !r.campStart || !r.timeIn || !r.timeOut);
    if (invalid >= 0) { setError("Row " + (invalid + 1) + ": select a job and fill out all three times."); return; }
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
        dailyTarget: r.dailyTarget.trim(),
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
        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
          <div className="min-w-0 space-y-4">
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

          <div className="min-w-0 space-y-4">
          {!loading && displayedRows.map(({ row, index }) => {
            const selectedProject = projects.find((project) => project.id === row.projectId);
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
                    <h3 id={"dispatch-job-" + row.key}>
                      <button
                        type="button"
                        aria-label={"Make Job " + (index + 1) + " active for resource assignment"}
                        aria-pressed={selected}
                        title={"Select Job " + (index + 1) + " for resource card clicks"}
                        onClick={() => setActiveJobKey(row.key)}
                        className="technical-eyebrow rounded-sm text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        JOB {String(index + 1).padStart(2, "0")} / DISPATCH
                      </button>
                    </h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
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
                        placeholder="Search job, project, client or SO No..."
                        disabled={saving}
                      />
                      {projects.length === 0 && (
                        <Link href="/projects" className="block text-xs text-[#365F91] underline">
                          Add or import projects first
                        </Link>
                      )}
                      {selectedProject && (
                        <div className="space-y-2">
                          <p className="break-words text-xs leading-5 text-muted-foreground">
                            SO: {selectedProject.soNo || "—"} · {selectedProject.clientName || "Client not specified"}
                          </p>
                          <div className="grid min-w-0 grid-cols-2 gap-2">
                            <div className="min-w-0 rounded-md border border-border bg-[#F8FAFD] px-3 py-2">
                              <p className="technical-eyebrow">Category</p>
                              <p className="mt-1 break-words text-xs font-medium text-foreground">
                                {selectedProject.mainCategory || "—"}
                              </p>
                            </div>
                            <div className="min-w-0 rounded-md border border-border bg-[#F8FAFD] px-3 py-2">
                              <p className="technical-eyebrow">Subcategory</p>
                              <p className="mt-1 break-words text-xs font-medium text-foreground">
                                {selectedProject.subCategory || "—"}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <Label htmlFor={row.key + "-daily-target"}>Daily Target</Label>
                      <Textarea
                        id={row.key + "-daily-target"}
                        placeholder="Enter the expected work or activity for this job today..."
                        rows={3}
                        maxLength={5000}
                        value={row.dailyTarget}
                        onChange={(event) => patch(row.key, "dailyTarget", event.target.value)}
                        className="min-h-[96px] w-full resize-y bg-white leading-5"
                        disabled={saving}
                      />
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
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-3">
                    {([
                      ["Foremen", "foremanSlots", foremanOptions],
                      ["Labourers", "labourSlots", employeeOptions],
                      ["Equipment", "equipmentSlots", equipmentOptions],
                    ] as const).map(([title, field, options]) => {
                      const ids = selectedIds(row, field);
                      const matchesDragging = dragging?.field === field;
                      const isOver = matchesDragging &&
                        dropTarget?.rowKey === row.key && dropTarget?.field === field;
                      return (
                        <div
                          key={field}
                          aria-label={"Drop " + title.toLowerCase() + " onto Job " + (index + 1)}
                          onDragOver={(event) => {
                            if (!matchesDragging || loading || saving) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "copy";
                            setDropTarget((previous) =>
                              previous?.rowKey === row.key && previous?.field === field
                                ? previous : { rowKey: row.key, field }
                            );
                          }}
                          onDrop={(event) => dropResource(event, row.key, field)}
                          className={"min-w-0 rounded-lg border-2 border-dashed p-3 transition-colors " +
                            (isOver
                              ? "border-[#365F91] bg-[#EAF2FC] ring-2 ring-[#365F91]/20"
                              : matchesDragging
                                ? "border-[#9DB5D1] bg-[#F5F8FC]"
                                : "border-[#DCE5EF] bg-white")}
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#365F91]">{title}</p>
                            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                              {ids.length}
                            </span>
                          </div>
                          {ids.length === 0 ? (
                            <p className="min-h-12 rounded-md border border-dashed border-border/70 px-2 py-3 text-center text-xs text-muted-foreground">
                              {matchesDragging ? "Drop here to assign" : "Drop " + title.toLowerCase() + " here"}
                            </p>
                          ) : (
                            <div className="min-w-0">
                              {field !== "equipmentSlots" && (
                                <div className={(field === "foremanSlots"
                                  ? "grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_20px]"
                                  : "grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1fr)_20px]") +
                                  " grid gap-x-2 border-b border-border px-2 pb-2 text-[10px] font-semibold uppercase leading-4 tracking-[0.025em] text-muted-foreground"}>
                                  <span className="min-w-0 break-words">Employee ID</span>
                                  <span className="min-w-0 break-words">Name</span>
                                  {field === "labourSlots" && (
                                    <span className="min-w-0 break-words">Designation</span>
                                  )}
                                  <span className="sr-only">Action</span>
                                </div>
                              )}
                              <ul className="max-h-52 min-w-0 space-y-1.5 overflow-y-auto pt-1.5">
                                {ids.map((id) => {
                                  const employee = field !== "equipmentSlots"
                                    ? employees.find((person) => person.id === id) : undefined;
                                  const name = employee?.name ||
                                    options.find((option) => option.value === id)?.label ||
                                    equipmentOptions.find((option) => option.value === id)?.label ||
                                    equipments.find((equipment) => equipment.id === id)?.vehicleDetails ||
                                    "Unknown resource";
                                  return (
                                    <li
                                      key={id}
                                      className={field === "equipmentSlots"
                                        ? "flex min-w-0 items-start justify-between gap-1 rounded-md border border-border bg-[#F8FAFD] px-2 py-1.5"
                                        : field === "foremanSlots"
                                          ? "grid min-w-0 grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)_20px] items-start gap-x-2 rounded-md border border-border bg-[#F8FAFD] px-2 py-1.5"
                                          : "grid min-w-0 grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1fr)_20px] items-start gap-x-2 rounded-md border border-border bg-[#F8FAFD] px-2 py-1.5"}
                                    >
                                      {field !== "equipmentSlots" && (
                                        <span className="min-w-0 break-words font-mono text-[11px] leading-5 text-[#365F91]">
                                          {employee?.employeeCode || "—"}
                                        </span>
                                      )}
                                      <span className="min-w-0 break-words text-xs leading-5 text-foreground">
                                        {name}
                                      </span>
                                      {field === "labourSlots" && (
                                        <span className="min-w-0 break-words text-[11px] leading-5 text-muted-foreground">
                                          {employee?.designation || "—"}
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        title={"Unassign " + name}
                                        aria-label={"Remove " + name + " from Job " + (index + 1)}
                                        disabled={loading || saving}
                                        onClick={() => unassignResource(row.key, field, id)}
                                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-red-50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
                                      >
                                        <X aria-hidden="true" className="size-3.5" />
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                          {matchesDragging && ids.length > 0 && (
                            <p className="mt-2 text-[11px] font-medium text-[#365F91]">
                              Drop to add another {title === "Equipment" ? "equipment item" : "person"}
                            </p>
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3">
            <p className="text-xs leading-5 text-muted-foreground">
              All times use 24-hour format. Night shifts can finish the next morning.
            </p>
            <Button variant="outline" size="sm" disabled={loading || saving} onClick={addJob}>
              <Plus className="size-4" /> Add Job
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border bg-white px-4 py-3">
            <Button variant="outline" asChild><Link href="/schedules">Cancel</Link></Button>
            <Button onClick={save} disabled={loading || saving || rows.length === 0}>
              <Save /> {saving ? "Saving..." : sheetId ? "Save Changes" : "Create Schedule"}
            </Button>
          </div>
          </div>
          <aside
            aria-label="Shared resource assignments"
            className="min-w-0 self-start overflow-hidden rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)] lg:sticky lg:top-20 lg:flex lg:h-[calc(100dvh-6rem)] lg:max-h-[calc(100dvh-6rem)] lg:flex-col"
          >
            <div className="shrink-0 border-b border-border bg-[#F8FAFD] px-3 py-3">
              <p className="technical-eyebrow">PLANNING / RESOURCES</p>
              <h3 className="mt-1 text-sm font-semibold text-primary">Resource Assignments</h3>
            </div>
            <div role="tablist" aria-label="Resource assignment categories" className="grid shrink-0 grid-cols-3 gap-0.5 border-b border-border bg-white px-2 pt-2">
              {([
                ["foremen", "Foremen"],
                ["labours", "Labours"],
                ["equipments", "Equipments"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  id={"resource-tab-" + tab}
                  role="tab"
                  aria-selected={resourceTab === tab}
                  aria-controls={"resource-panel-" + tab}
                  tabIndex={resourceTab === tab ? 0 : -1}
                  className={"min-w-0 rounded-t-md border-b-2 px-1 py-2 text-center text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 " +
                    (resourceTab === tab
                      ? "border-[#365F91] bg-[#EAF2FC] text-primary"
                      : "border-transparent text-muted-foreground hover:bg-[#F5F8FC] hover:text-primary")}
                  onClick={() => setResourceTab(tab)}
                  onKeyDown={(event) => onResourceTabKeyDown(event, tab)}
                >
                  {label}
                </button>
              ))}
            </div>
            {activeRow ? (
              <div className="h-[360px] min-h-0 p-2.5 lg:h-auto lg:flex-1">
                <div
                  id="resource-panel-foremen"
                  role="tabpanel"
                  aria-labelledby="resource-tab-foremen"
                  tabIndex={0}
                  className={resourceTab === "foremen" ? "h-full min-h-0" : "hidden"}
                >
                  {renderResourceList(
                    activeRow, activeIndex, "foremanSlots", "Foremen", foremanOptions,
                    "No Site Foremen in the employee directory. Designation must be Site Foreman.",
                  )}
                </div>
                <div
                  id="resource-panel-labours"
                  role="tabpanel"
                  aria-labelledby="resource-tab-labours"
                  tabIndex={0}
                  className={resourceTab === "labours" ? "h-full min-h-0" : "hidden"}
                >
                  {renderResourceList(
                    activeRow, activeIndex, "labourSlots", "Labourers", employeeOptions,
                    "No employees in the directory. Add or import labourers first.",
                  )}
                </div>
                <div
                  id="resource-panel-equipments"
                  role="tabpanel"
                  aria-labelledby="resource-tab-equipments"
                  tabIndex={0}
                  className={resourceTab === "equipments" ? "h-full min-h-0" : "hidden"}
                >
                  {renderResourceList(
                    activeRow, activeIndex, "equipmentSlots", "Equipment", equipmentOptions,
                    "No equipment in the directory. Add or import equipment first.",
                  )}
                </div>
              </div>
            ) : (
              <p className="p-4 text-xs text-muted-foreground">No job selected.</p>
            )}
          </aside>
        </div>

      </section>

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
