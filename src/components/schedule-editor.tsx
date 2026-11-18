"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Plus, Save, Trash2 } from "lucide-react";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { Button } from "@/components/ui/button";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import { SortableTableHead, type TableSortDirection } from "@/components/ui/sortable-table-head";
import { compareTableValues } from "@/lib/table-sort";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    foremanSlots: [assignmentSlot()],
    labourSlots: [assignmentSlot()],
    equipmentSlots: [assignmentSlot()],
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
          foremanSlots: r.foremanIds.length ? r.foremanIds.map((id) => assignmentSlot(id)) : [assignmentSlot()],
          labourSlots: r.employeeIds.length ? r.employeeIds.map((id) => assignmentSlot(id)) : [assignmentSlot()],
          equipmentSlots: r.equipmentIds.length ? r.equipmentIds.map((id) => assignmentSlot(id)) : [assignmentSlot()],
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

  function updateSlot(rowKey: string, field: SlotField, slotKey: string, resourceId: string) {
    setRows((current) => current.map((row) => row.key !== rowKey ? row : ({
      ...row,
      [field]: row[field].map((slot) => slot.key === slotKey ? { ...slot, resourceId } : slot),
    })));
    setError("");
  }

  function addSlot(rowKey: string, field: SlotField) {
    setRows((current) => current.map((row) =>
      row.key === rowKey && row[field].length < assignmentLimits[field]
        ? { ...row, [field]: [...row[field], assignmentSlot()] }
        : row
    ));
  }

  function removeSlot(rowKey: string, field: SlotField, slotKey: string) {
    setRows((current) => current.map((row) =>
      row.key === rowKey && row[field].length > 1
        ? { ...row, [field]: row[field].filter((slot) => slot.key !== slotKey) }
        : row
    ));
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
    setRows((current) => current.flatMap((row) => {
      if (row.key !== rowKey) return [row];
      return [row, {
        ...row,
        id: undefined,
        key: crypto.randomUUID(),
        foremanSlots: row.foremanSlots.map((slot) => assignmentSlot(slot.resourceId)),
        labourSlots: row.labourSlots.map((slot) => assignmentSlot(slot.resourceId)),
        equipmentSlots: row.equipmentSlots.map((slot) => assignmentSlot(slot.resourceId)),
      }];
    }));
    setError("");
  }

  // A sorted table is only a view over rows: saving/exporting preserve original
  // schedule job order and every selector remains attached to its stable row key.
  const displayedRows = rows.map((row, index) => ({ row, index }));
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

  function renderSlots(
    row: EditorRow,
    index: number,
    field: SlotField,
    label: "Foreman" | "Labour" | "Equipment",
    options: ComboboxOption[]
  ) {
    const hasInvalidSelection = row[field].some((slot) =>
      slot.resourceId && !options.some((option) => option.value === slot.resourceId)
    );
    return (
      <TableCell className="min-w-0 px-3 py-2 align-top">
        <div className="space-y-1.5">
          {row[field].map((slot, slotIndex) => (
            <div key={slot.key} className="flex min-w-0 items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <SearchCombobox
                  label={label + " " + (slotIndex + 1) + " for job " + (index + 1)}
                  value={slot.resourceId}
                  onValueChange={(id) => updateSlot(row.key, field, slot.key, id)}
                  options={options.map((option) => ({
                    ...option,
                    disabled: row[field].some((other) =>
                      other.key !== slot.key && other.resourceId === option.value
                    ),
                  }))}
                  placeholder={"Search " + label.toLowerCase() + "..."}
                  disabled={saving}
                />
              </div>
              {row[field].length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 shrink-0 text-destructive hover:text-destructive"
                  disabled={saving}
                  aria-label={"Remove " + label.toLowerCase() + " " + (slotIndex + 1) + " from job " + (index + 1)}
                  onClick={() => removeSlot(row.key, field, slot.key)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            disabled={saving || row[field].length >= assignmentLimits[field]}
            onClick={() => addSlot(row.key, field)}
          >
            <Plus className="size-3.5" /> Add {label}
          </Button>
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {field === "foremanSlots"
                ? "No Site Foremen found. Set employee Designation to Site Foreman on the Employees page."
                : field === "labourSlots"
                  ? "Add or import employees before assigning labour."
                  : "Add or import equipment before assigning it."}
            </p>
          )}
          {hasInvalidSelection && (
            <p className="text-xs text-destructive" role="alert">
              {label} assignment no longer matches the available options; select a valid record.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            {selectedIds(row, field).length} selected · minimum 1
          </p>
        </div>
      </TableCell>
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
          <p className="mt-1 text-sm text-muted-foreground">Assign jobs, foremen, labours, and working times for each dispatch team.</p>
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
      <section className="min-w-0 rounded-xl border bg-white">
        <div className="flex flex-col items-start justify-between gap-3 border-b px-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <div>
            <h2 className="font-semibold">Dispatch table</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One row = one scheduled job. A job may have multiple foremen, labourers and equipment assignments.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={loading || saving} onClick={() => setRows((current) => [...current, newRow()])}>
            <Plus /> Add Job
          </Button>
        </div>

        <p className="px-3 py-2 text-xs text-muted-foreground lg:hidden">
          Scroll the dispatch table sideways to assign jobs, teams, equipment, shifts and times.
        </p>
        <Table className="min-w-[1945px] table-fixed">
          <colgroup>
            <col style={{ width: 58 }} />
            <col style={{ width: 380 }} />
            <col style={{ width: 285 }} />
            <col style={{ width: 285 }} />
            <col style={{ width: 285 }} />
            <col style={{ width: 115 }} />
            <col style={{ width: 215 }} />
            <col style={{ width: 236 }} />
            <col style={{ width: 86 }} />
          </colgroup>
          <TableHeader className="bg-[#f0f5fa]">
            <TableRow className="h-9">
              {([
                ["original", "#", "w-[55px] pl-4", "Original job order (sorting does not change saved order)"],
                ["job", "Select Job", "w-[380px]", "Sort by job number or project name"],
                ["foremen", "Foremen *", "w-[285px]", "Sort by number of foremen selected"],
                ["labours", "Labours *", "w-[285px]", "Sort by number of labourers selected"],
                ["equipment", "Equipment *", "w-[285px]", "Sort by number of equipment items selected"],
                ["shift", "Day / Night", "w-[115px]", "Sort by shift"],
                ["scope", "Scope", "w-[215px]", "Sort by scope"],
                ["time", "Time", "w-[236px]", "Sort by start time"],
              ] as const).map(([key, label, width, title]) => (
                <SortableTableHead
                  key={key}
                  label={label}
                  direction={sort.key === key ? sort.direction : undefined}
                  onSort={() => sortBy(key)}
                  className={width}
                  title={title}
                />
              ))}
              <TableHead className="h-9 w-[85px] pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && displayedRows.map(({ row, index }) => {
              const customScope = !!row.scope && !scopeOptions.some((scope) => scope === row.scope);
              const selectedProject = projects.find((project) => project.id === row.projectId);
              return (
                <TableRow key={row.key} className="[&>td]:align-top">
                  <TableCell className="pl-4 py-2 align-top font-medium text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="w-[380px] px-4 py-2 align-top">
                    <div className="min-w-0 space-y-1.5">
                      <SearchCombobox
                        label={"Job for dispatch " + (index + 1)}
                        value={row.projectId}
                        onValueChange={(value) => patch(row.key, "projectId", value)}
                        options={projectOptions}
                        placeholder="Search Job No, SO No or Project..."
                        disabled={saving}
                      />
                      {projects.length === 0 && (
                        <Link href="/projects" className="block text-xs underline">
                          Add or import projects first
                        </Link>
                      )}
                      {selectedProject && (
                        <div className="min-w-0 space-y-0.5 text-xs leading-4 text-muted-foreground">
                          <p className="break-words font-medium text-foreground">{selectedProject.name || "Unnamed project"}</p>
                          <p className="break-words">
                            SO: {selectedProject.soNo || "—"} · {selectedProject.clientName || "Client not specified"}
                          </p>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  {renderSlots(row, index, "foremanSlots", "Foreman", foremanOptions)}
                  {renderSlots(row, index, "labourSlots", "Labour", employeeOptions)}
                  {renderSlots(row, index, "equipmentSlots", "Equipment", equipmentOptions)}
                  <TableCell className="py-2 align-top">
                    <SelectField label={"Shift for dispatch " + (index + 1)} value={row.shift}
                      onChange={(value) => patch(row.key, "shift", value as DispatchEntry["shift"])}>
                      <option value="Day">Day</option><option value="Night">Night</option>
                    </SelectField>
                  </TableCell>
                  <TableCell className="py-2 align-top">
                    <SelectField label={"Scope for dispatch " + (index + 1)}
                      value={customScope ? "__other__" : row.scope}
                      onChange={(value) => patch(row.key, "scope", value === "__other__" ? "Other" : value)}>
                      <option value="">Select scope...</option>
                      {scopeOptions.map((scope) => <option key={scope} value={scope}>{scope}</option>)}
                      <option value="__other__">Other (specify)</option>
                    </SelectField>
                    {customScope && <Input className="mt-2" maxLength={200} value={row.scope}
                      aria-label={"Custom scope for dispatch " + (index + 1)} placeholder="Describe scope..."
                      onChange={(event) => patch(row.key, "scope", event.target.value)} />}
                  </TableCell>
                  <TableCell className="space-y-1 py-2">
                    {([
                      ["campStart", "Camp start"],
                      ["timeIn", "Start time"],
                      ["timeOut", "End time"],
                    ] as const).map(([field, label]) => (
                      <div key={field} className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-1.5">
                        <label className="text-[11px] text-muted-foreground" htmlFor={row.key + field}>{label}</label>
                        <Input id={row.key + field} type="time" value={row[field]}
                          onChange={(event) => patch(row.key, field, event.target.value)} className="h-8 min-w-0 w-full px-2 text-xs" />
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="pr-4 py-2 text-right align-top">
                    <div className="flex justify-end">
                      <RowActionsMenu
                        itemName={"dispatch job " + (index + 1)}
                        onDuplicate={() => duplicateJob(row.key)}
                        onDelete={() => setRemoveTarget(row.key)}
                        deleteLabel="Remove job"
                        disabled={saving}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {!loading && rows.length === 0 && <TableRow>
              <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                No dispatch rows. Click Add Job / Team to start.
              </TableCell>
            </TableRow>}
            {loading && <TableRow><TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
              Loading schedule and resources...
            </TableCell></TableRow>}
          </TableBody>
        </Table>
        <div className="flex flex-col items-start justify-between gap-3 border-t px-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
          <p className="text-xs text-muted-foreground">24-hour times · Night shifts may finish the next morning.</p>
          <Button variant="outline" size="sm" disabled={loading || saving} onClick={() => setRows((current) => [...current, newRow()])}>
            <Plus /> Add Job
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
