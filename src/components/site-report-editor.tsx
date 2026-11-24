"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Trash2, Truck, Users } from "lucide-react";
import { SearchCombobox, type ComboboxOption } from "@/components/ui/search-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Employee, Equipment, Project } from "@/lib/catalog";
import { apiRequest } from "@/lib/http";
import { dateKey, dateLabel } from "@/lib/schedule";
import {
  DEFAULT_EQUIPMENT_ROWS, DEFAULT_LABOUR_ROWS, OT_HOUR_OPTIONS, hoursBetween, type SiteReport,
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

export function SiteReportEditor({ reportId }: { reportId?: string }) {
  const router = useRouter();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [projectId, setProjectId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [activityDescription, setActivityDescription] = React.useState("");
  const [remarks, setRemarks] = React.useState("");
  const [labours, setLabours] = React.useState<LabourRow[]>(() => blankRows(DEFAULT_LABOUR_ROWS, () => labourRow()));
  const [vehicles, setVehicles] = React.useState<EquipmentRow[]>(() => blankRows(DEFAULT_EQUIPMENT_ROWS, () => equipmentRow()));
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [meta, setMeta] = React.useState<{ createdBy: string | null; updatedAt: string } | null>(null);

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
    const source = labours[0];
    if (!source) return;
    setLabours((current) => current.map((row) => ({ ...row, timeIn: source.timeIn, timeOut: source.timeOut })));
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

  return (
    <main className="w-full min-w-0 max-w-none px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10">
      <Link href="/site-reports" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to site reports
      </Link>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="technical-eyebrow mb-1.5">OPERATIONS / SITE DAILY REPORT</p>
          <h1 className="text-[28px] font-semibold tracking-tight text-primary">
            {reportId ? "Edit Site Daily Report" : "New Site Daily Report"}
          </h1>
          {meta && (
            <p className="mt-1 text-xs text-muted-foreground">
              {meta.createdBy ? "Submitted by " + meta.createdBy + " · " : ""}
              Last updated {new Date(meta.updatedAt).toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
        <Button className="h-10 w-full sm:w-auto" disabled={disabled} onClick={save}>
          <Save /> {saving ? "Saving..." : reportId ? "Save Changes" : "Submit Report"}
        </Button>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {loading ? (
        <div className="rounded-xl border bg-white px-4 py-12 text-center text-sm text-muted-foreground">Loading report and directories...</div>
      ) : (
        <div className="space-y-5">
          {/* Report details */}
          <section className="rounded-xl border border-border bg-white p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold">Report details</h2>
            <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)]">
              <div className="min-w-0 space-y-1.5">
                <Label asChild><span>Job order no.</span></Label>
                <SearchCombobox label="Job order no." value={projectId} onValueChange={(value) => { setProjectId(value); setError(""); }}
                  options={projectOptions} placeholder="Search job order no., project or client" disabled={disabled} />
                {project && (
                  <p className="text-xs text-muted-foreground">
                    {project.name || "Project name not recorded"} · {project.clientName || "Client not specified"}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-date">Date</Label>
                <Input id="report-date" type="date" className="h-10" value={date} disabled={disabled}
                  onChange={(event) => { setDate(event.target.value); setError(""); }} />
                {date && <p className="text-xs text-muted-foreground">{dateLabel(date)}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-activity">Activity description</Label>
                <Textarea id="report-activity" rows={4} value={activityDescription} disabled={disabled} maxLength={5000}
                  onChange={(event) => setActivityDescription(event.target.value)} />
                <p className="text-xs text-muted-foreground">Optional. Work carried out on site today.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-remarks">Remarks</Label>
                <Textarea id="report-remarks" rows={4} value={remarks} disabled={disabled} maxLength={5000}
                  onChange={(event) => setRemarks(event.target.value)} />
                <p className="text-xs text-muted-foreground">Optional. Delays, issues or notes.</p>
              </div>
            </div>
          </section>

          {/* Labour */}
          <section className="rounded-xl border border-border bg-white">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold"><Users className="size-4 text-muted-foreground" /> Labour</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  At least one employee. {filledLabours.length} selected · {totalOt} OT hours. Empty rows are ignored.
                </p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={disabled || labours.length < 2} onClick={applyTimesToAll}
                  title="Copy row 1 time in and time out to every row">
                  Copy row 1 times to all
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={disabled || labours.length >= 200}
                  onClick={() => setLabours((current) => [...current, labourRow(current[current.length - 1])])}>
                  <Plus /> Add labour
                </Button>
              </div>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#f0f5fa]">
                  <tr className="text-left font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-[#50677f]">
                    <th className="w-10 py-2 pl-4 sm:pl-6">#</th>
                    <th className="px-2 py-2">Employee</th>
                    <th className="w-32 px-2 py-2">Time in</th>
                    <th className="w-32 px-2 py-2">Time out</th>
                    <th className="w-20 px-2 py-2 text-right">Hours</th>
                    <th className="w-28 px-2 py-2">OT hours</th>
                    <th className="w-12 py-2 pr-4 sm:pr-6"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {labours.map((row, index) => (
                    <tr key={row.key} className="border-b border-border/80 last:border-0">
                      <td className="py-2 pl-4 font-mono text-xs text-muted-foreground sm:pl-6">{index + 1}</td>
                      <td className="px-2 py-2">
                        <SearchCombobox label={"Labour " + (index + 1) + " employee"} value={row.employeeId}
                          onValueChange={(value) => patchLabour(row.key, { employeeId: value })}
                          options={employeeOptions(row.key)} placeholder="Select employee" disabled={disabled} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="time" aria-label={"Labour " + (index + 1) + " time in"} className="h-10" value={row.timeIn}
                          disabled={disabled} onChange={(event) => patchLabour(row.key, { timeIn: event.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="time" aria-label={"Labour " + (index + 1) + " time out"} className="h-10" value={row.timeOut}
                          disabled={disabled} onChange={(event) => patchLabour(row.key, { timeOut: event.target.value })} />
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {row.employeeId ? hoursBetween(row.timeIn, row.timeOut) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <select aria-label={"Labour " + (index + 1) + " OT hours"} className={selectClass} value={row.otHours}
                          disabled={disabled} onChange={(event) => patchLabour(row.key, { otHours: Number(event.target.value) })}>
                          {OT_HOUR_OPTIONS.map((hours) => <option key={hours} value={hours}>{hours}</option>)}
                        </select>
                      </td>
                      <td className="py-2 pr-4 text-right sm:pr-6">
                        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
                          title="Remove row" aria-label={"Remove labour row " + (index + 1)} onClick={() => removeLabour(row.key)}>
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Equipment */}
          <section className="rounded-xl border border-border bg-white">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold"><Truck className="size-4 text-muted-foreground" /> Equipment</h2>
                <p className="mt-1 text-xs text-muted-foreground">Optional. {filledVehicles.length} vehicle{filledVehicles.length === 1 ? "" : "s"} selected.</p>
              </div>
              <Button type="button" variant="outline" size="sm" disabled={disabled || vehicles.length >= 100}
                onClick={() => setVehicles((current) => [...current, equipmentRow()])}>
                <Plus /> Add vehicle
              </Button>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[#f0f5fa]">
                  <tr className="text-left font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-[#50677f]">
                    <th className="w-10 py-2 pl-4 sm:pl-6">#</th>
                    <th className="w-[40%] px-2 py-2">Vehicle no.</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="w-12 py-2 pr-4 sm:pr-6"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((row, index) => {
                    const equipment = equipments.find((entry) => entry.id === row.equipmentId);
                    return (
                      <tr key={row.key} className="border-b border-border/80 last:border-0">
                        <td className="py-2 pl-4 font-mono text-xs text-muted-foreground sm:pl-6">{index + 1}</td>
                        <td className="px-2 py-2">
                          <SearchCombobox label={"Equipment " + (index + 1) + " vehicle no."} value={row.equipmentId}
                            onValueChange={(value) => setVehicles((current) => current.map((entry) =>
                              entry.key === row.key ? { ...entry, equipmentId: value } : entry))}
                            options={vehicleOptions(row.key)} placeholder="Select vehicle no." disabled={disabled} />
                        </td>
                        <td className="px-2 py-2 text-sm text-muted-foreground">
                          {equipment ? equipment.description || equipment.vehicleDetails || "—" : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right sm:pr-6">
                          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
                            title="Remove row" aria-label={"Remove equipment row " + (index + 1)}
                            onClick={() => setVehicles((current) => current.length > 1
                              ? current.filter((entry) => entry.key !== row.key) : [equipmentRow()])}>
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-end">
            <Button className="h-10 w-full sm:w-auto" disabled={disabled} onClick={save}>
              <Save /> {saving ? "Saving..." : reportId ? "Save Changes" : "Submit Report"}
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
