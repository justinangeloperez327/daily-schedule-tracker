"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Download, Plus, Save, Trash2, Users } from "lucide-react";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Project, Employee, Equipment } from "@/lib/catalog";
import { emptyDispatch, scopeOptions, type DispatchEntry, type DispatchSheet } from "@/lib/dispatch";
import { apiRequest } from "@/lib/http";
import { dateKey, dateLabel } from "@/lib/schedule";

type EmployeeSlot = { key: string; employeeId: string };
type EditorRow = Omit<DispatchEntry, "foremanIds" | "employeeIds"> & {
  key: string;
  foremanSlots: EmployeeSlot[];
  labourSlots: EmployeeSlot[];
};
type PickerField = "equipmentIds";
type Picker = { rowKey: string; field: PickerField };

function employeeSlot(employeeId = ""): EmployeeSlot {
  return { key: crypto.randomUUID(), employeeId };
}

function newRow(): EditorRow {
  const draft = emptyDispatch();
  return {
    key: crypto.randomUUID(),
    projectId: draft.projectId,
    foremanSlots: [employeeSlot()],
    equipmentIds: draft.equipmentIds,
    shift: draft.shift,
    scope: draft.scope,
    campStart: draft.campStart,
    timeIn: draft.timeIn,
    timeOut: draft.timeOut,
    labourSlots: [employeeSlot()],
  };
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (value: string) => void; children: React.ReactNode;
}) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}
    className="h-10 w-full min-w-0 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
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
  const [picker, setPicker] = React.useState<Picker | null>(null);
  const [pickerSearch, setPickerSearch] = React.useState("");

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
          foremanSlots: r.foremanIds.length ? r.foremanIds.map((id) => employeeSlot(id)) : [employeeSlot()],
          labourSlots: r.employeeIds.length ? r.employeeIds.map((id) => employeeSlot(id)) : [employeeSlot()],
          equipmentIds: r.equipmentIds,
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

  function patch<Key extends Exclude<keyof DispatchEntry, "foremanIds" | "employeeIds">>(key: string, field: Key, value: DispatchEntry[Key]) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
    setError("");
  }

  function updateEmployeeSlot(rowKey: string, field: "foremanSlots" | "labourSlots", slotKey: string, employeeId: string) {
    setRows((current) => current.map((row) => row.key !== rowKey ? row : ({
      ...row,
      [field]: row[field].map((slot) => slot.key === slotKey ? { ...slot, employeeId } : slot),
    })));
    setError("");
  }

  function addEmployeeSlot(rowKey: string, field: "foremanSlots" | "labourSlots") {
    const limit = field === "foremanSlots" ? 60 : 150;
    setRows((current) => current.map((row) =>
      row.key === rowKey && row[field].length < limit
        ? { ...row, [field]: [...row[field], employeeSlot()] }
        : row
    ));
  }

  function removeEmployeeSlot(rowKey: string, field: "foremanSlots" | "labourSlots", slotKey: string) {
    setRows((current) => current.map((row) =>
      row.key === rowKey && row[field].length > 1
        ? { ...row, [field]: row[field].filter((slot) => slot.key !== slotKey) }
        : row
    ));
    setError("");
  }

  function selectedEmployees(row: EditorRow, field: "foremanSlots" | "labourSlots"): string[] {
    return row[field].map((slot) => slot.employeeId).filter(Boolean);
  }

  function toggleResource(key: string, field: PickerField, id: string) {
    setRows((current) => current.map((row) => row.key !== key ? row : ({
      ...row,
      [field]: row[field].includes(id)
        ? row[field].filter((value) => value !== id)
        : [...row[field], id],
    })));
  }

  function openPicker(row: EditorRow, field: PickerField) {
    setPicker({ rowKey: row.key, field });
    setPickerSearch("");
  }
  const pickerRow = picker ? rows.find((row) => row.key === picker.rowKey) : undefined;
  const pickerItems = equipments.map((item) => ({
    id: item.id,
    name: item.vehicleDetails || item.registrationNo || "Unnamed equipment",
    detail: item.vehicleType,
  }));
  const matches = pickerItems.filter((item) =>
    (item.name + " " + item.detail).toLowerCase().includes(pickerSearch.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

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

  function chosenEquipmentNames(row: EditorRow): string {
    if (!row.equipmentIds.length) return "Select equipment";
    return row.equipmentIds.map((id) => equipments.find((e) => e.id === id)?.vehicleDetails || "Equipment").join(", ");
  }

  async function save() {
    if (saving || loading) return;
    if (!date) { setError("Select a date."); return; }
    if (!rows.length) { setError("Add at least one dispatch row."); return; }
    const invalid = rows.findIndex((r) => !r.projectId || !r.scope.trim() || !r.campStart || !r.timeIn || !r.timeOut);
    if (invalid >= 0) { setError("Row " + (invalid + 1) + ": select job and scope, and fill out all three times."); return; }
    const missingLabour = rows.findIndex((r) => selectedEmployees(r, "labourSlots").length === 0);
    if (missingLabour >= 0) {
      setError("Row " + (missingLabour + 1) + ": select at least one labour.");
      return;
    }
    const missingForeman = rows.findIndex((r) => selectedEmployees(r, "foremanSlots").length === 0);
    if (missingForeman >= 0) {
      setError("Row " + (missingForeman + 1) + ": select at least one foreman.");
      return;
    }
    const missingEquipment = rows.findIndex((r) => r.equipmentIds.length === 0);
    if (missingEquipment >= 0) {
      setError("Row " + (missingEquipment + 1) + ": select at least one equipment item.");
      return;
    }
    setSaving(true); setError("");
    try {
      const payload = { date, jobs: rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        projectId: r.projectId, foremanIds: selectedEmployees(r, "foremanSlots"),
        employeeIds: selectedEmployees(r, "labourSlots"),
        equipmentIds: r.equipmentIds, shift: r.shift, scope: r.scope.trim(),
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
          foremanIds: selectedEmployees(row, "foremanSlots"),
          employeeIds: selectedEmployees(row, "labourSlots"),
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
          <h1 className="text-[28px] font-semibold tracking-tight">{sheetId ? "Edit Schedule" : "Create Schedule"}</h1>
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
        <Table className="min-w-[1720px] table-auto">
          <TableHeader className="bg-[#f8f9fa]">
            <TableRow>
              <TableHead className="w-[55px] pl-5">#</TableHead>
              <TableHead className="min-w-[275px]">Select Job</TableHead>
              <TableHead className="min-w-[275px]">Foremen *</TableHead>
              <TableHead className="min-w-[275px]">Labours *</TableHead>
              <TableHead className="min-w-[190px]">Equipment *</TableHead>
              <TableHead className="min-w-[120px]">Day / Night</TableHead>
              <TableHead className="min-w-[210px]">Scope</TableHead>
              <TableHead className="min-w-[235px]">Time</TableHead>
              <TableHead className="w-[85px] pr-5 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && rows.map((row, index) => {
              const customScope = !!row.scope && !scopeOptions.some((scope) => scope === row.scope);
              return (
                <TableRow key={row.key} className="align-top">
                  <TableCell className="pl-5 pt-5 font-medium text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="pt-4">
                    <SearchCombobox
                      label={"Job for dispatch " + (index + 1)}
                      value={row.projectId}
                      onValueChange={(value) => patch(row.key, "projectId", value)}
                      options={projectOptions}
                      placeholder="Search Job No, SO No or Project..."
                      disabled={saving}
                    />
                    {projects.length === 0 && <Link href="/projects" className="mt-2 block text-xs underline">Add/import projects first</Link>}
                    {row.projectId && <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {projects.find((p) => p.id === row.projectId)?.clientName || "Client not specified"}
                    </p>}
                  </TableCell>
                  <TableCell className="min-w-[260px] py-4 align-top">
                    <div className="space-y-2.5">
                      {row.foremanSlots.map((slot, slotIndex) => (
                        <div key={slot.key} className="flex min-w-0 items-center gap-1.5">
                          <div className="min-w-0 flex-1">
                            <SearchCombobox
                              label={"Foreman " + (slotIndex + 1) + " for job " + (index + 1)}
                              value={slot.employeeId}
                              onValueChange={(id) => updateEmployeeSlot(row.key, "foremanSlots", slot.key, id)}
                              options={employeeOptions.map((option) => ({
                                ...option,
                                disabled: row.foremanSlots.some((other) =>
                                  other.key !== slot.key && other.employeeId === option.value
                                ),
                              }))}
                              placeholder="Search foreman by name or ID..."
                              disabled={saving}
                            />
                          </div>
                          {row.foremanSlots.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              className="shrink-0 text-destructive hover:text-destructive"
                              aria-label={"Remove foreman " + (slotIndex + 1) + " from job " + (index + 1)}
                              onClick={() => removeEmployeeSlot(row.key, "foremanSlots", slot.key)}
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
                        disabled={saving || row.foremanSlots.length >= 60}
                        onClick={() => addEmployeeSlot(row.key, "foremanSlots")}
                      >
                        <Plus className="size-3.5" /> Add Foreman
                      </Button>
                      {employees.length === 0 && (
                        <Link href="/employees" className="block text-xs text-muted-foreground underline">
                          Add or import employees first
                        </Link>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {selectedEmployees(row, "foremanSlots").length} selected · minimum 1
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[260px] py-4 align-top">
                    <div className="space-y-2.5">
                      {row.labourSlots.map((slot, slotIndex) => (
                        <div key={slot.key} className="flex min-w-0 items-center gap-1.5">
                          <div className="min-w-0 flex-1">
                            <SearchCombobox
                              label={"Labour " + (slotIndex + 1) + " for job " + (index + 1)}
                              value={slot.employeeId}
                              onValueChange={(id) => updateEmployeeSlot(row.key, "labourSlots", slot.key, id)}
                              options={employeeOptions.map((option) => ({
                                ...option,
                                disabled: row.labourSlots.some((other) =>
                                  other.key !== slot.key && other.employeeId === option.value
                                ),
                              }))}
                              placeholder="Search labour by name or ID..."
                              disabled={saving}
                            />
                          </div>
                          {row.labourSlots.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              disabled={saving}
                              className="shrink-0 text-destructive hover:text-destructive"
                              aria-label={"Remove labour " + (slotIndex + 1) + " from job " + (index + 1)}
                              onClick={() => removeEmployeeSlot(row.key, "labourSlots", slot.key)}
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
                        disabled={saving || row.labourSlots.length >= 150}
                        onClick={() => addEmployeeSlot(row.key, "labourSlots")}
                      >
                        <Plus className="size-3.5" /> Add Labour
                      </Button>
                      {employees.length === 0 && (
                        <Link href="/employees" className="block text-xs text-muted-foreground underline">
                          Add or import employees first
                        </Link>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {selectedEmployees(row, "labourSlots").length} selected · minimum 1
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[190px] py-4 align-top">
                    <Button variant="outline" className="h-auto min-h-10 w-full items-start justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
                      onClick={() => openPicker(row, "equipmentIds")}>
                      <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-xs leading-5 [overflow-wrap:anywhere]">{chosenEquipmentNames(row)}</span>
                      <ChevronDown className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.equipmentIds.length} selected · minimum 1</p>
                  </TableCell>
                  <TableCell className="pt-4">
                    <SelectField label={"Shift for dispatch " + (index + 1)} value={row.shift}
                      onChange={(value) => patch(row.key, "shift", value as DispatchEntry["shift"])}>
                      <option value="Day">Day</option><option value="Night">Night</option>
                    </SelectField>
                  </TableCell>
                  <TableCell className="pt-4">
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
                  <TableCell className="space-y-2 py-3">
                    {([
                      ["campStart", "Camp start"],
                      ["timeIn", "Start time"],
                      ["timeOut", "End time"],
                    ] as const).map(([field, label]) => (
                      <div key={field} className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-2">
                        <label className="text-[11px] text-muted-foreground" htmlFor={row.key + field}>{label}</label>
                        <Input id={row.key + field} type="time" value={row[field]}
                          onChange={(event) => patch(row.key, field, event.target.value)} className="h-9 min-w-0 w-full px-2 text-xs" />
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="pr-5 pt-4 text-right">
                    <Button size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive"
                      aria-label={"Remove dispatch row " + (index + 1)}
                      onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                      <Trash2 className="size-4" />
                    </Button>
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

      <Dialog open={!!picker} onOpenChange={(open) => { if (!open) setPicker(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Select Equipment</DialogTitle>
            <DialogDescription>Select multiple resources for this job. Click Done when finished.</DialogDescription>
          </DialogHeader>
          <Input value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)}
            placeholder="Search by name or designation..." aria-label="Search resources" />
          <div className="max-h-[350px] min-h-[120px] space-y-1 overflow-y-auto rounded-md border p-2">
            {matches.map((item) => {
              const checked = !!picker && !!pickerRow && pickerRow[picker.field].includes(item.id);
              return <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
                <input className="size-4 accent-[#20262e]" type="checkbox" checked={checked}
                  onChange={() => { if (picker) toggleResource(picker.rowKey, picker.field, item.id); }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                </span>
                {checked && <Check className="size-4" />}
              </label>;
            })}
            {matches.length === 0 && <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
              <Users className="size-6" /> No matching records
            </div>}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{picker && pickerRow ? pickerRow[picker.field].length : 0} selected</span>
            <Button onClick={() => setPicker(null)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
