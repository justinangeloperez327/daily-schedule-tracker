"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Download, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Project, Employee, Equipment } from "@/lib/catalog";
import { emptyDispatch, scopeOptions, type DispatchEntry, type DispatchSheet } from "@/lib/dispatch";
import { apiRequest } from "@/lib/http";
import { dateKey, dateLabel } from "@/lib/schedule";

type EditorRow = DispatchEntry & { key: string };
type PickerField = "foremanIds" | "employeeIds" | "equipmentIds";
type Picker = { rowKey: string; field: PickerField };

function newRow(): EditorRow {
  return { key: crypto.randomUUID(), ...emptyDispatch() };
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
  const [rows, setRows] = React.useState<EditorRow[]>([{ key: "first", ...emptyDispatch() }]);
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
      sheetId ? apiRequest<DispatchSheet>("/api/schedule-sheets/" + encodeURIComponent(sheetId)) : Promise.resolve(null),
    ]).then(([p, e, equipment, sheet]) => {
      if (!active) return;
      setProjects(p); setEmployees(e); setEquipments(equipment);
      if (sheet) {
        setDate(sheet.date);
        setRows(sheet.dispatches.map((r) => ({
          key: r.id || crypto.randomUUID(),
          id: r.id,
          projectId: r.projectId,
          foremanIds: r.foremanIds,
          employeeIds: r.employeeIds,
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

  function patch<Key extends keyof DispatchEntry>(key: string, field: Key, value: DispatchEntry[Key]) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
    setError("");
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
  const pickerItems = picker?.field === "equipmentIds"
    ? equipments.map((item) => ({ id: item.id, name: item.vehicleDetails || item.registrationNo || "Unnamed equipment", detail: item.vehicleType }))
    : employees.map((item) => ({ id: item.id, name: item.name || item.employeeCode || "Unnamed employee", detail: item.designation }));
  const matches = pickerItems.filter((item) => (item.name + " " + item.detail).toLowerCase().includes(pickerSearch.toLowerCase()))
    .sort((a, b) => {
      if (picker?.field !== "foremanIds") return a.name.localeCompare(b.name);
      return Number(/foreman/i.test(b.detail)) - Number(/foreman/i.test(a.detail)) || a.name.localeCompare(b.name);
    });

  function chosenNames(row: EditorRow, field: PickerField): string {
    const items = field === "equipmentIds"
      ? row.equipmentIds.map((id) => equipments.find((e) => e.id === id)?.vehicleDetails || "Equipment")
      : row[field].map((id) => employees.find((e) => e.id === id)?.name || "Employee");
    if (!items.length) return field === "foremanIds" ? "Select foremen" : field === "employeeIds" ? "Select labours" : "Select equipment";
    return items.join(", ");
  }

  async function save() {
    if (saving || loading) return;
    if (!date) { setError("Select a date."); return; }
    if (!rows.length) { setError("Add at least one dispatch row."); return; }
    const invalid = rows.findIndex((r) => !r.projectId || !r.scope.trim() || !r.campStart || !r.timeIn || !r.timeOut);
    if (invalid >= 0) { setError("Row " + (invalid + 1) + ": select job and scope, and fill out all three times."); return; }
    setSaving(true); setError("");
    try {
      const payload = { date, dispatches: rows.map((r) => ({
        ...(r.id ? { id: r.id } : {}),
        projectId: r.projectId, foremanIds: r.foremanIds, employeeIds: r.employeeIds,
        equipmentIds: r.equipmentIds, shift: r.shift, scope: r.scope.trim(),
        campStart: r.campStart, timeIn: r.timeIn, timeOut: r.timeOut,
      })) };
      await apiRequest<DispatchSheet>(sheetId ? "/api/schedule-sheets/" + encodeURIComponent(sheetId) : "/api/schedule-sheets", {
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
      await exportDispatchSheet(date, rows, projects, employees, equipments);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Export failed."); }
    finally { setExporting(false); }
  }

  return (
    <main className="w-full max-w-none px-4 pb-16 pt-9 sm:px-6 lg:px-8 2xl:px-10">
      <Link href="/schedules" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to schedules
      </Link>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">{sheetId ? "Edit Schedule" : "Create Schedule"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Assign jobs, foremen, labours, and working times for each dispatch team.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={loading || exporting || rows.length === 0} onClick={exportExcel}>
            <Download /> {exporting ? "Exporting..." : "Export Excel"}
          </Button>
          <Button disabled={loading || saving || rows.length === 0} onClick={save}>
            <Save /> {saving ? "Saving..." : sheetId ? "Save Changes" : "Create Schedule"}
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-8 rounded-xl border bg-white px-5 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="dispatch-date">Schedule Date</Label>
          <Input id="dispatch-date" type="date" value={date} disabled={loading || saving}
            onChange={(event) => setDate(event.target.value)} className="w-48" />
        </div>
        <div><p className="text-xs text-muted-foreground">Date</p>
          <p className="mt-1 text-sm font-medium">{date ? dateLabel(date) : "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Jobs</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{new Set(rows.map((r) => r.projectId).filter(Boolean)).size}</p></div>
        <div><p className="text-xs text-muted-foreground">Team dispatches</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{rows.length}</p></div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <section className="rounded-xl border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Dispatch table</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              One row = one team dispatch. A job may have multiple rows, foremen and labourers.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={loading || saving} onClick={() => setRows((current) => [...current, newRow()])}>
            <Plus /> Add Job / Team
          </Button>
        </div>

        <Table className="min-w-[1620px] table-auto">
          <TableHeader className="bg-[#f8f9fa]">
            <TableRow>
              <TableHead className="w-[55px] pl-5">#</TableHead>
              <TableHead className="min-w-[275px]">Select Job</TableHead>
              <TableHead className="min-w-[200px]">Foremen</TableHead>
              <TableHead className="min-w-[210px]">Labours</TableHead>
              <TableHead className="min-w-[190px]">Equipment</TableHead>
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
                    <SelectField label={"Job for dispatch " + (index + 1)} value={row.projectId}
                      onChange={(value) => patch(row.key, "projectId", value)}>
                      <option value="">Select job...</option>
                      {projects.map((project) => <option key={project.id} value={project.id}>
                        {project.jobNo || "No job no."} — {project.name || "Unnamed project"}
                      </option>)}
                    </SelectField>
                    {projects.length === 0 && <Link href="/projects" className="mt-2 block text-xs underline">Add/import projects first</Link>}
                    {row.projectId && <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {projects.find((p) => p.id === row.projectId)?.clientName || "Client not specified"}
                    </p>}
                  </TableCell>
                  {(["foremanIds", "employeeIds", "equipmentIds"] as PickerField[]).map((field) => (
                    <TableCell key={field} className="min-w-[190px] py-4 align-top">
                      <Button variant="outline" className="h-auto min-h-10 w-full items-start justify-between gap-2 whitespace-normal px-3 py-2 text-left font-normal"
                        onClick={() => openPicker(row, field)}>
                        <span className="min-w-0 flex-1 whitespace-normal break-words text-left text-xs leading-5 [overflow-wrap:anywhere]">{chosenNames(row, field)}</span>
                        <ChevronDown className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                      <p className="mt-1 text-[11px] text-muted-foreground">{row[field].length} selected</p>
                    </TableCell>
                  ))}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <p className="text-xs text-muted-foreground">24-hour times · Night shifts may finish the next morning.</p>
          <Button variant="outline" size="sm" disabled={loading || saving} onClick={() => setRows((current) => [...current, newRow()])}>
            <Plus /> Add Job / Team
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
            <DialogTitle>{picker?.field === "foremanIds" ? "Select Foremen" :
              picker?.field === "employeeIds" ? "Select Labours" : "Select Equipment"}</DialogTitle>
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
