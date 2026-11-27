"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Clock, NotebookPen, Plus, Save, Trash2, Truck, Users } from "lucide-react";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Employee, Equipment, Project } from "@/lib/catalog";
import { apiRequest } from "@/lib/http";
import { dateKey, dateLabel } from "@/lib/schedule";
import {
  DEFAULT_EQUIPMENT_ROWS, DEFAULT_LABOUR_ROWS, OT_HOUR_OPTIONS, hoursBetween, type LabourUsage, type SiteReport,
} from "@/lib/site-report";

type LabourRow = { key: string; employeeId: string; timeIn: string; timeOut: string; otHours: number };
type EquipmentRow = { key: string; equipmentId: string };

const DEFAULT_TIME_IN = "07:00";
const DEFAULT_TIME_OUT = "17:00";
const UNAVAILABLE_STATUSES = new Set(["Inactive", "Terminated"]);

function labourRow(template?: Partial<LabourRow>): LabourRow {
  return {
    key: crypto.randomUUID(),
    employeeId: "",
    timeIn: template?.timeIn || DEFAULT_TIME_IN,
    timeOut: template?.timeOut || DEFAULT_TIME_OUT,
    otHours: 0,
  };
}
function equipmentRow(equipmentId = ""): EquipmentRow {
  return { key: crypto.randomUUID(), equipmentId };
}
function blankRows<T>(count: number, make: () => T) {
  return Array.from({ length: count }, make);
}

const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-white px-2.5 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50";

export function SiteReportEditor({ reportId, initialProjectId = "" }: { reportId?: string; initialProjectId?: string }) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [projectId, setProjectId] = React.useState(reportId ? "" : initialProjectId);
  const [date, setDate] = React.useState("");
  const [activityDescription, setActivityDescription] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [labours, setLabours] = React.useState<LabourRow[]>(() => blankRows(DEFAULT_LABOUR_ROWS, () => labourRow()));
  const [vehicles, setVehicles] = React.useState<EquipmentRow[]>(() => blankRows(DEFAULT_EQUIPMENT_ROWS, () => equipmentRow()));
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [meta, setMeta] = React.useState<{ createdBy: string | null; updatedAt: string } | null>(null);
  const [usage, setUsage] = React.useState<LabourUsage[]>([]);
  // Default shift: new labour rows start with these times; "Apply to all" copies them to every row.
  const [defaultIn, setDefaultIn] = React.useState(DEFAULT_TIME_IN);
  const [defaultOut, setDefaultOut] = React.useState(DEFAULT_TIME_OUT);

  // Load employees already reported elsewhere on this date (warn only, never block).
  React.useEffect(() => {
    if (!date) return;
    let active = true;
    const query = "?date=" + encodeURIComponent(date) + (reportId ? "&exclude=" + encodeURIComponent(reportId) : "");
    apiRequest<LabourUsage[]>("/api/site-reports/labour-usage" + query)
      .then((rows) => { if (active) setUsage(rows); })
      .catch(() => { if (active) setUsage([]); });
    return () => { active = false; };
  }, [date, reportId]);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<Project[]>("/api/projects"),
      apiRequest<Employee[]>("/api/employees"),
      apiRequest<Equipment[]>("/api/equipments"),
      reportId ? apiRequest<SiteReport>("/api/site-reports/" + encodeURIComponent(reportId)) : Promise.resolve(null),
    ]).then(([p, e, eq, report]) => {
      if (!active) return;
      setProjects(p); setEmployees(e); setEquipments(eq);
      if (report) {
        setProjectId(report.projectId);
        setDate(report.date);
        setActivityDescription(report.activityDescription);
        setRemarks(report.remarks);
        setLabours(report.labours.map((labour) => ({ key: crypto.randomUUID(), ...labour })));
        if (report.labours[0]) { setDefaultIn(report.labours[0].timeIn); setDefaultOut(report.labours[0].timeOut); }
        setVehicles(report.equipmentIds.length ? report.equipmentIds.map((id) => equipmentRow(id)) : [equipmentRow()]);
        setMeta({ createdBy: report.createdBy, updatedAt: report.updatedAt });
      } else {
        setDate(dateKey(new Date()));
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to load the report.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportId]);

  const disabled = loading || saving;
  const project = projects.find((entry) => entry.id === projectId);
  const filledLabours = labours.filter((row) => row.employeeId);
  const filledVehicles = vehicles.filter((row) => row.equipmentId);
  const totalOt = filledLabours.reduce((sum, row) => sum + row.otHours, 0);
  const totalHours = filledLabours.reduce((sum, row) => sum + hoursBetween(row.timeIn, row.timeOut), 0);
  const usageByEmployee = React.useMemo(() => {
    const map = new Map<string, LabourUsage[]>();
    for (const entry of usage) map.set(entry.employeeId, [...(map.get(entry.employeeId) ?? []), entry]);
    return map;
  }, [usage]);
  const doubleEntered = filledLabours.filter((row) => usageByEmployee.has(row.employeeId));
  function usageNote(employeeId: string) {
    return (usageByEmployee.get(employeeId) ?? [])
      .map((entry) => entry.jobNo + " (" + entry.timeIn + "–" + entry.timeOut + ")").join(", ");
  }

  const projectOptions: ComboboxOption[] = React.useMemo(() => projects.map((entry) => {
    const projectName = (entry.name || "").trim();
    const hasName = !!projectName && !/^unnamed project$/i.test(projectName);
    const jobNo = entry.jobNo?.trim() || "No Job No.";
    const clientName = entry.clientName?.trim() || "Client not specified";
    return {
      value: entry.id,
      label: jobNo + " — " + (hasName ? projectName : clientName),
      searchText: [entry.jobNo, entry.soNo, entry.name, entry.clientName].filter(Boolean).join(" "),
      project: { jobNo, projectName, clientName, soNo: entry.soNo?.trim() || "—", hasName },
    };
  }), [projects]);

  function employeeOptions(rowKey: string): ComboboxOption[] {
    const current = labours.find((row) => row.key === rowKey)?.employeeId;
    const taken = new Set(labours.filter((row) => row.key !== rowKey).map((row) => row.employeeId).filter(Boolean));
    return employees.map((employee) => {
      const unavailable = UNAVAILABLE_STATUSES.has(employee.status) && employee.id !== current;
      return {
        value: employee.id,
        label: employee.name || employee.employeeCode || "Unnamed employee",
        description: [
          employee.employeeCode, employee.designation,
          taken.has(employee.id) ? "Already in this report" : unavailable ? employee.status : "",
        ].filter(Boolean).join(" · "),
        searchText: [employee.employeeCode, employee.designation].filter(Boolean).join(" "),
        disabled: taken.has(employee.id) || unavailable,
      };
    });
  }

  function vehicleOptions(rowKey: string): ComboboxOption[] {
    const taken = new Set(vehicles.filter((row) => row.key !== rowKey).map((row) => row.equipmentId).filter(Boolean));
    return equipments.map((equipment) => {
      const vehicleNo = equipment.fleet || equipment.registrationNo || "No vehicle no.";
      return {
        value: equipment.id,
        label: vehicleNo,
        description: [equipment.description || equipment.vehicleDetails, taken.has(equipment.id) ? "Already in this report" : ""]
          .filter(Boolean).join(" · "),
        searchText: [equipment.registrationNo, equipment.description, equipment.vehicleDetails].filter(Boolean).join(" "),
        disabled: taken.has(equipment.id),
      };
    });
  }

  function patchLabour(key: string, patch: Partial<LabourRow>) {
    setLabours((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
    setError("");
  }
  function removeLabour(key: string) {
    setLabours((current) => current.length > 1 ? current.filter((row) => row.key !== key) : [labourRow(current[0])]);
  }
  function applyTimesToAll() {
    setLabours((current) => current.map((row) => ({ ...row, timeIn: defaultIn, timeOut: defaultOut })));
  }
  function addLabour() {
    setLabours((current) => [...current, labourRow({ timeIn: defaultIn, timeOut: defaultOut })]);
  }

  async function save() {
    if (disabled) return;
    if (!projectId) { setError("Select a project by its job order number."); return; }
    if (!date) { setError("Select the report date."); return; }
    if (filledLabours.length === 0) { setError("Select at least one employee in the labour section."); return; }
    const missingTime = labours.findIndex((row) => row.employeeId && (!row.timeIn || !row.timeOut));
    if (missingTime >= 0) { setError("Labour row " + (missingTime + 1) + ": enter both time in and time out."); return; }

    setSaving(true); setError("");
    try {
      const payload = {
        projectId,
        date,
        activityDescription: activityDescription.trim(),
        remarks: remarks.trim(),
        labours: filledLabours.map(({ employeeId, timeIn, timeOut, otHours }) => ({ employeeId, timeIn, timeOut, otHours })),
        equipmentIds: filledVehicles.map((row) => row.equipmentId),
      };
      await apiRequest<SiteReport>(reportId ? "/api/site-reports/" + encodeURIComponent(reportId) : "/api/site-reports", {
        method: reportId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.push("/site-reports");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the report.");
      setSaving(false);
    }
  }


  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  return (
    <main className="w-full min-w-0 max-w-none px-3 pt-6 sm:px-6 lg:px-8 2xl:px-10">
      <Link href="/site-reports" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Site reports
      </Link>
      <div className="mb-6">
        <p className="technical-eyebrow mb-1.5">OPERATIONS / SITE DAILY REPORT</p>
        <h1 className="text-[28px] font-semibold tracking-tight text-primary">
          {reportId ? "Edit Site Daily Report" : "New Site Daily Report"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {meta
            ? (meta.createdBy ? "Submitted by " + meta.createdBy + " · " : "") + "Last updated " +
              new Date(meta.updatedAt).toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })
            : "Record who worked on the job today, their hours, and the vehicles used."}
        </p>
      </div>

      {loading ? (
        <div className="mb-12 rounded-xl border bg-white px-4 py-12 text-center text-sm text-muted-foreground">Loading report and directories...</div>
      ) : (
        <div className="space-y-5">
          {/* 1. Job & date */}
          <FormSection step={1} title="Job & date" description="Choose the job order and the day this report covers.">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="min-w-0 space-y-1.5">
                <Label asChild><span>Job order no.</span></Label>
                <SearchCombobox label="Job order no." value={projectId} onValueChange={(value) => { setProjectId(value); setError(""); }}
                  options={projectOptions} placeholder="Search job order no., project or client" disabled={disabled} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-date">Date</Label>
                <Input id="report-date" type="date" className="h-10" value={date} disabled={disabled}
                  onChange={(event) => { setDate(event.target.value); setError(""); }} />
              </div>
            </div>
            {(project || date) && (
              <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-lg border border-border bg-[#F7FAFE] px-4 py-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="min-w-0 sm:col-span-2 lg:col-span-1">
                  <dt className="text-xs text-muted-foreground">Project</dt>
                  <dd className="truncate font-medium">{project ? project.name || "Project name not recorded" : "—"}</dd>
                </div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Client</dt><dd className="truncate">{project?.clientName || "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Sub category · In charge</dt>
                  <dd className="truncate">{project ? (project.subCategory || "—") + " · " + (project.projectInCharge || "—") : "—"}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Report date</dt><dd className="truncate">{date ? dateLabel(date) : "—"}</dd></div>
              </dl>
            )}
          </FormSection>

          {/* 2. Labour */}
          <FormSection step={2} icon={Users} title="Labour"
            description={"At least one employee. " + filledLabours.length + " selected. Empty rows are ignored."}
            aside={
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-[#F7FAFE] p-2.5">
                <p className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock className="size-3.5" aria-hidden="true" /> Default shift</p>
                <label className="space-y-1">
                  <span className="block text-[11px] text-muted-foreground">Time in</span>
                  <Input type="time" className="h-9 w-[7.5rem] bg-white" value={defaultIn} disabled={disabled}
                    onChange={(event) => setDefaultIn(event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="block text-[11px] text-muted-foreground">Time out</span>
                  <Input type="time" className="h-9 w-[7.5rem] bg-white" value={defaultOut} disabled={disabled}
                    onChange={(event) => setDefaultOut(event.target.value)} />
                </label>
                <Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled || !defaultIn || !defaultOut}
                  onClick={applyTimesToAll}>Apply to all</Button>
              </div>
            }>
            {doubleEntered.length > 0 && (
              <p role="status" className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {doubleEntered.length === 1 ? "1 employee is" : doubleEntered.length + " employees are"} already in another
                report on this date. Check their hours aren&apos;t counted twice. You can still submit.
              </p>
            )}
            <div className={"hidden gap-x-2 border-b border-border pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-[#50677f] md:grid " + LABOUR_GRID}>
              <span>#</span><span>Employee</span><span>Time in</span><span>Time out</span><span className="text-right">Hours</span><span>OT hours</span><span />
            </div>
            <ol className="divide-y divide-border/80">
              {labours.map((row, index) => {
                const employee = row.employeeId ? employeeById.get(row.employeeId) : undefined;
                const hours = row.employeeId ? hoursBetween(row.timeIn, row.timeOut) : null;
                return (
                  <li key={row.key} className={"grid gap-x-2 gap-y-2 py-3 md:items-start " + LABOUR_GRID}>
                    <span className="pt-2.5 font-mono text-xs text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0">
                      <SearchCombobox label={"Labour " + (index + 1) + " employee"} value={row.employeeId}
                        onValueChange={(value) => patchLabour(row.key, { employeeId: value })}
                        options={employeeOptions(row.key)} placeholder="Select employee" disabled={disabled} />
                      {employee && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {[employee.employeeCode, employee.designation].filter(Boolean).join(" · ") || "No designation"}
                          {hours !== null && <span className="md:hidden"> · {hours} h worked</span>}
                        </p>
                      )}
                      {usageByEmployee.has(row.employeeId) && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-amber-700">
                          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                          Also reported on this date: {usageNote(row.employeeId)}
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" className="mt-1 md:order-last" disabled={disabled}
                      title="Remove row" aria-label={"Remove labour row " + (index + 1)} onClick={() => removeLabour(row.key)}>
                      <Trash2 />
                    </Button>
                    {/* On phones the times sit on their own line under the employee. */}
                    <div className="col-start-2 grid grid-cols-2 gap-2 md:contents">
                      <label className="min-w-0 md:contents">
                        <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">Time in</span>
                        <Input type="time" aria-label={"Labour " + (index + 1) + " time in"} className="h-10 px-2" value={row.timeIn}
                          disabled={disabled} onChange={(event) => patchLabour(row.key, { timeIn: event.target.value })} />
                      </label>
                      <label className="min-w-0 md:contents">
                        <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">Time out</span>
                        <Input type="time" aria-label={"Labour " + (index + 1) + " time out"} className="h-10 px-2" value={row.timeOut}
                          disabled={disabled} onChange={(event) => patchLabour(row.key, { timeOut: event.target.value })} />
                      </label>
                      <span className="hidden pt-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground md:block">{hours ?? "—"}</span>
                      <label className="min-w-0 md:contents">
                        <span className="mb-1 block text-[11px] text-muted-foreground md:hidden">OT hours</span>
                        <select aria-label={"Labour " + (index + 1) + " OT hours"} className={selectClass} value={row.otHours}
                          disabled={disabled} onChange={(event) => patchLabour(row.key, { otHours: Number(event.target.value) })}>
                          {OT_HOUR_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ol>
            <button type="button" onClick={addLabour} disabled={disabled || labours.length >= 200}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm font-medium text-[#365F91] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50">
              <Plus className="size-4" aria-hidden="true" /> Add labour
            </button>
          </FormSection>

          {/* 3. Equipment */}
          <FormSection step={3} icon={Truck} title="Equipment"
            description={"Optional. " + filledVehicles.length + " vehicle" + (filledVehicles.length === 1 ? "" : "s") + " selected."}>
            <div className={"hidden gap-x-2 border-b border-border pb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-[#50677f] md:grid " + EQUIPMENT_GRID}>
              <span>#</span><span>Vehicle no.</span><span>Description</span><span />
            </div>
            <ol className="divide-y divide-border/80">
              {vehicles.map((row, index) => {
                const equipment = equipments.find((entry) => entry.id === row.equipmentId);
                const description = equipment ? equipment.description || equipment.vehicleDetails || "—" : "—";
                return (
                  <li key={row.key} className={"grid items-start gap-x-2 gap-y-1 py-3 " + EQUIPMENT_GRID}>
                    <span className="pt-2.5 font-mono text-xs text-muted-foreground">{index + 1}</span>
                    <div className="min-w-0">
                      <SearchCombobox label={"Equipment " + (index + 1) + " vehicle no."} value={row.equipmentId}
                        onValueChange={(value) => setVehicles((current) => current.map((entry) =>
                          entry.key === row.key ? { ...entry, equipmentId: value } : entry))}
                        options={vehicleOptions(row.key)} placeholder="Select vehicle no." disabled={disabled} />
                      {equipment && <p className="mt-1 truncate text-xs text-muted-foreground md:hidden">{description}</p>}
                    </div>
                    <p className="hidden pt-2.5 text-sm text-muted-foreground md:block">{description}</p>
                    <Button type="button" variant="ghost" size="icon-sm" className="mt-1" disabled={disabled}
                      title="Remove row" aria-label={"Remove equipment row " + (index + 1)}
                      onClick={() => setVehicles((current) => current.length > 1
                        ? current.filter((entry) => entry.key !== row.key) : [equipmentRow()])}>
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ol>
            <button type="button" disabled={disabled || vehicles.length >= 100}
              onClick={() => setVehicles((current) => [...current, equipmentRow()])}
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm font-medium text-[#365F91] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50">
              <Plus className="size-4" aria-hidden="true" /> Add vehicle
            </button>
          </FormSection>

          {/* 4. Work done & remarks */}
          <FormSection step={4} icon={NotebookPen} title="Work done & remarks" description="Optional notes for the office.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="report-activity">Activity description</Label>
                <Textarea id="report-activity" rows={4} value={activityDescription} disabled={disabled} maxLength={5000}
                  placeholder="Work carried out on site today" onChange={(event) => setActivityDescription(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-remarks">Remarks</Label>
                <Textarea id="report-remarks" rows={4} value={remarks} disabled={disabled} maxLength={5000}
                  placeholder="Delays, issues or other notes" onChange={(event) => setRemarks(event.target.value)} />
              </div>
            </div>
          </FormSection>
        </div>
      )}

      {/* Sticky summary and submit */}
      <div className="sticky bottom-0 z-30 -mx-3 mt-6 border-t border-border bg-white/95 px-3 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 2xl:-mx-10 2xl:px-10">
        {error && <p role="alert" className="mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            <span className="font-semibold text-primary">{filledLabours.length}</span> labour ·{" "}
            <span className="font-semibold text-primary">{Math.round(totalHours * 100) / 100}</span> hrs ·{" "}
            <span className="font-semibold text-primary">{totalOt}</span> OT ·{" "}
            <span className="font-semibold text-primary">{filledVehicles.length}</span> vehicle{filledVehicles.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 flex-1 sm:flex-none" asChild><Link href="/site-reports">Cancel</Link></Button>
            <Button className="h-10 flex-1 sm:flex-none" disabled={disabled} onClick={save}>
              <Save /> {saving ? "Saving..." : reportId ? "Save changes" : "Submit report"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

const LABOUR_GRID = "grid-cols-[1.5rem_minmax(0,1fr)_2.25rem] md:grid-cols-[1.5rem_minmax(0,1fr)_7.5rem_7.5rem_3.5rem_6rem_2.25rem]";
const EQUIPMENT_GRID = "grid-cols-[1.5rem_minmax(0,1fr)_2.25rem] md:grid-cols-[1.5rem_minmax(0,20rem)_minmax(0,1fr)_2.25rem]";

function FormSection({ step, icon: Icon, title, description, aside, children }: {
  step: number;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-xs font-semibold text-white">{step}</span>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {title}{Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
