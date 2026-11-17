"use client";

import * as React from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, ChevronDown,
  ClipboardList, Columns3, Plus, Search, SlidersHorizontal, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeRowActions } from "@/components/employee-row-actions";
import { ImportExcelDialog, type ImportResult } from "@/components/import-excel-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Employee } from "@/lib/catalog";
import { catalogConfigs } from "@/lib/catalog-config";
import { employeeStatuses, type EmployeeStatus } from "@/lib/employee-status";
import { apiRequest } from "@/lib/http";

type ColumnKey = "employeeCode" | "name" | "designation" | "location" | "category" | "joiningDate" | "status" | "remarks";
type EmployeeColumn = { key: ColumnKey; label: string; width?: number; required?: boolean };
type Direction = "asc" | "desc";
type Density = "comfortable" | "compact";
type FilterKey = "designation" | "location" | "category" | "status";
type Filters = Record<FilterKey, string>;

const columns: EmployeeColumn[] = [
  { key: "employeeCode", label: "Employee ID", width: 110, required: true },
  { key: "name", label: "Name", required: true },
  { key: "designation", label: "Designation", width: 180 },
  { key: "location", label: "Location", width: 110 },
  { key: "category", label: "Category", width: 120 },
  { key: "joiningDate", label: "Joining Date", width: 135 },
  { key: "status", label: "Status", width: 115 },
  { key: "remarks", label: "Remarks", width: 220 },
];

const initialFilters: Filters = { designation: "", location: "", category: "", status: "" };
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const employeeConfig = catalogConfigs.employees;
const emptyDraft = () => ({
  employeeCode: "", name: "", designation: "", location: "", category: "",
  joiningDate: "", status: "Active", remarks: "",
});

function dateText(value: string) {
  if (!value) return "—";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function statusText(value: string): EmployeeStatus {
  return employeeStatuses.includes(value as EmployeeStatus) ? value as EmployeeStatus : "Not set";
}

function StatusBadge({ status }: { status: string }) {
  const current = statusText(status);
  const colors: Record<EmployeeStatus, string> = {
    Active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Inactive: "bg-slate-100 text-slate-600 ring-slate-200",
    "On leave": "bg-amber-50 text-amber-800 ring-amber-200",
    Terminated: "bg-red-50 text-red-700 ring-red-200",
    "Not set": "bg-gray-50 text-gray-600 ring-gray-200",
  };
  return <span className={"inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset " + colors[current]}>{current}</span>;
}

export function EmployeeDirectory() {
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(initialFilters);
  const [density, setDensity] = React.useState<Density>("comfortable");
  const [visibleOverrides, setVisibleOverrides] = React.useState<Partial<Record<ColumnKey, boolean>>>({});
  const [sort, setSort] = React.useState<{ key: ColumnKey; direction: Direction }>({ key: "name", direction: "asc" });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>(emptyDraft);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<Employee | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");

  const reload = React.useCallback(async () => {
    const rows = await apiRequest<Employee[]>("/api/employees");
    setEmployees(rows);
    setError("");
  }, []);

  React.useEffect(() => {
    let live = true;
    apiRequest<Employee[]>("/api/employees")
      .then((rows) => { if (live) { setEmployees(rows); setError(""); } })
      .catch((cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : "Unable to load employees.");
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  function columnVisible(column: EmployeeColumn) {
    if (column.required) return true;
    if (visibleOverrides[column.key] !== undefined) return !!visibleOverrides[column.key];
    if (column.key === "remarks") return false; // Notes remain accessible via Name tooltip.
    const unique = new Set(employees.map((employee) => String(employee[column.key] ?? "").trim().toLowerCase()));
    return unique.size !== 1;
  }
  const displayedColumns = columns.filter(columnVisible);

  const filterChoices = React.useMemo(() => ({
    designation: [...new Set(employees.map((e) => e.designation.trim()))].sort(collator.compare),
    location: [...new Set(employees.map((e) => e.location.trim()))].sort(collator.compare),
    category: [...new Set(employees.map((e) => e.category.trim()))].sort(collator.compare),
    status: [...new Set(employees.map((e) => statusText(e.status)))].sort(collator.compare),
  }), [employees]);

  const filtered = React.useMemo(() => {
    const search = query.trim().toLowerCase();
    return employees
      .filter((employee) => (
        (!search || [employee.employeeCode ?? "", employee.name, employee.designation].some((text) => text.toLowerCase().includes(search))) &&
        (!filters.designation || (employee.designation.trim() || "__blank__") === filters.designation) &&
        (!filters.location || (employee.location.trim() || "__blank__") === filters.location) &&
        (!filters.category || (employee.category.trim() || "__blank__") === filters.category) &&
        (!filters.status || statusText(employee.status) === filters.status)
      ))
      .sort((a, b) => {
        const aValue = sort.key === "status" ? statusText(a.status) : String(a[sort.key] ?? "");
        const bValue = sort.key === "status" ? statusText(b.status) : String(b[sort.key] ?? "");
        // Always put missing values last, independent of ascending / descending sort.
        const aBlank = !aValue.trim();
        const bBlank = !bValue.trim();
        if (aBlank !== bBlank) return aBlank ? 1 : -1;
        const compared = collator.compare(aValue, bValue);
        return (sort.direction === "asc" ? compared : -compared) || collator.compare(a.name, b.name);
      });
  }, [employees, filters, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleRows = filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  const start = filtered.length ? (activePage - 1) * pageSize + 1 : 0;
  const end = Math.min(activePage * pageSize, filtered.length);
  const hasFilters = !!query.trim() || Object.values(filters).some(Boolean);

  function updateFilter(key: FilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }
  function resetFilters() {
    setQuery("");
    setFilters({ ...initialFilters });
    setPage(1);
  }
  function updateSort(key: ColumnKey) {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
    setPage(1);
  }

  function addEmployee() {
    setEditingId(null);
    setDraft(emptyDraft());
    setFormError("");
    setEditOpen(true);
  }
  function editEmployee(employee: Employee) {
    setEditingId(employee.id);
    setDraft(Object.fromEntries(employeeConfig.fields.map((field) => [field.key, String(employee[field.key as keyof Employee] ?? "")])));
    setFormError("");
    setEditOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    const data = Object.fromEntries(employeeConfig.fields.map((field) => [field.key, (draft[field.key] ?? "").trim()]));
    try {
      const saved = await apiRequest<Employee>(editingId ? "/api/employees/" + encodeURIComponent(editingId) : "/api/employees", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setEmployees((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [...current, saved]);
      setEditOpen(false);
      setNotice(editingId ? "Employee updated." : "Employee added.");
      setError("");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to save employee.");
    } finally { setSaving(false); }
  }

  async function deleteEmployee() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest<{ success: true }>("/api/employees/" + encodeURIComponent(deleteTarget.id), { method: "DELETE" });
      setEmployees((current) => current.filter((item) => item.id !== deleteTarget.id));
      setNotice("Employee deleted.");
      setError("");
      setDeleteTarget(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Unable to delete employee.");
    } finally { setDeleting(false); }
  }

  async function onImported(result: ImportResult) {
    await reload();
    setNotice("Imported " + result.created + " employee records from Excel.");
    setPage(1);
  }

  function renderValue(employee: Employee, key: ColumnKey) {
    if (key === "status") return <StatusBadge status={employee.status} />;
    if (key === "joiningDate") {
      return employee.joiningDate
        ? <span className="tabular-nums">{dateText(employee.joiningDate)}</span>
        : <span className="text-muted-foreground">—</span>;
    }
    const text = key === "employeeCode" ? employee.employeeCode ?? "" : String(employee[key] ?? "");
    if (!text) return <span className="text-muted-foreground">—</span>;
    if (key === "name") {
      return <span className="block truncate font-semibold text-[#20262e]" title={employee.remarks || employee.name}>{text}</span>;
    }
    return <span className={"block truncate " + (key === "employeeCode" ? "font-mono tabular-nums font-medium text-[#374151]" : "text-[#545b64]")} title={text}>{text}</span>;
  }

  const rowHeight = density === "comfortable" ? "h-12" : "h-10";
  const padding = density === "comfortable" ? "px-3 py-1.5" : "px-3 py-1";

  return (
    <main className="min-h-[calc(100vh-64px)] w-full bg-[#f6f7f9] px-4 pb-16 pt-9 sm:px-6 lg:px-8 2xl:px-10 lg:pt-12">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] sm:text-[32px]">Employees</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Employee register with designations, locations and joining details.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExcelDialog kind="employees" onImported={onImported} />
          <Button className="h-10 px-4" onClick={addEmployee}><Plus className="size-4" /> Add Employee</Button>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-md border border-border bg-white px-3 py-2 text-sm">{notice}</p>}
      <section className="overflow-visible rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">Employee directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "record" : "records"}
              {hasFilters && <span> matching filters · {employees.length} total</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search employee ID, name or designation"
                value={query}
                placeholder="Search ID, name, designation..."
                className="pl-9"
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Density
              <select
                aria-label="Table density"
                value={density}
                onChange={(event) => setDensity(event.target.value as Density)}
                className="h-9 rounded-md border border-input bg-white px-2 text-sm text-foreground"
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <details className="relative">
              <summary
                className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden"
                aria-label="Choose visible employee columns"
              >
                <Columns3 className="size-4" /> Columns <ChevronDown className="size-3.5" />
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-lg border border-border bg-white p-2 shadow-lg">
                <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">Visible columns</p>
                {columns.map((column) => (
                  <label key={column.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      disabled={column.required}
                      checked={columnVisible(column)}
                      onChange={(event) => setVisibleOverrides((prev) => ({ ...prev, [column.key]: event.target.checked }))}
                      className="size-4 accent-[#20262e]"
                    />
                    {column.label}
                  </label>
                ))}
                <p className="px-2 pt-2 text-xs text-muted-foreground">Name and Employee ID are always shown.</p>
              </div>
            </details>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-3 sm:px-6">
          <SlidersHorizontal aria-hidden="true" className="mb-2.5 size-4 text-muted-foreground" />
          {(["designation", "location", "category", "status"] as FilterKey[]).map((key) => (
            <label key={key} className="flex min-w-[142px] flex-col gap-1 text-xs font-medium text-[#545b64]">
              {key === "designation" ? "Designation" : key === "location" ? "Location" : key === "category" ? "Category" : "Status"}
              <select
                value={filters[key]}
                onChange={(event) => updateFilter(key, event.target.value)}
                className="h-9 max-w-[200px] rounded-md border border-input bg-white px-2 text-sm font-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">All {key === "status" ? "statuses" : key === "category" ? "categories" : key + "s"}</option>
                {filterChoices[key].map((choice) => (
                  <option key={choice || "__blank__"} value={choice || "__blank__"}>
                    {choice || "Not specified"}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {hasFilters && (
            <Button variant="ghost" size="sm" className="mb-0.5" onClick={resetFilters}>
              <X className="size-4" /> Clear filters
            </Button>
          )}
        </div>

        <Table className="w-full min-w-[1000px] table-fixed">
          <colgroup>
            {displayedColumns.map((column) => (
              <col key={column.key} style={column.width ? { width: column.width } : undefined} />
            ))}
            <col style={{ width: 80 }} />
          </colgroup>
          <TableHeader className="bg-[#f8f9fa]">
            <TableRow className="h-10">
              {displayedColumns.map((column) => {
                const sorted = sort.key === column.key;
                return (
                  <TableHead
                    key={column.key}
                    scope="col"
                    aria-sort={sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                    className="h-10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.045em] text-[#48515e]"
                  >
                    <button
                      type="button"
                      aria-label={"Sort by " + column.label + (sorted && sort.direction === "asc" ? " descending" : " ascending")}
                      className="inline-flex w-full items-center gap-1.5 text-left uppercase outline-none hover:text-[#1f2937] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/30"
                      onClick={() => updateSort(column.key)}
                    >
                      <span className="min-w-0 break-words">{column.label}</span>
                      {sorted
                        ? sort.direction === "asc" ? <ArrowUp aria-hidden="true" className="size-3 shrink-0" /> : <ArrowDown aria-hidden="true" className="size-3 shrink-0" />
                        : <ArrowUpDown aria-hidden="true" className="size-3 shrink-0 opacity-50" />}
                    </button>
                  </TableHead>
                );
              })}
              <TableHead scope="col" className="h-10 px-2 py-1.5 text-right text-[11px] font-semibold tracking-[0.045em] text-[#48515e]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visibleRows.map((employee) => (
              <TableRow key={employee.id} className={rowHeight + " hover:bg-[#EAF3FF] focus-within:bg-[#EDF5FF]"}>
                {displayedColumns.map((column) => (
                  <TableCell key={column.key} className={padding + " min-w-0 max-w-0 align-middle text-sm leading-5"}>
                    {renderValue(employee, column.key)}
                  </TableCell>
                ))}
                <TableCell className={padding + " text-right align-middle"}>
                  <div className="flex justify-end">
                    <EmployeeRowActions
                      employeeName={employee.name || employee.employeeCode || "this employee"}
                      onEdit={() => editEmployee(employee)}
                      onDelete={() => { setDeleteTarget(employee); setDeleteError(""); }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(loading || filtered.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={displayedColumns.length + 1} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ClipboardList aria-hidden="true" className="size-7" />
                    <p className="text-sm font-semibold text-foreground">
                      {loading ? "Loading employees..." : employees.length === 0 ? "No employees yet" : "No employees match your filters"}
                    </p>
                    {!loading && hasFilters && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={resetFilters}>Clear filters</Button>
                    )}
                    {!loading && employees.length === 0 && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={addEmployee}>
                        <Plus className="size-4" /> Add Employee
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            Showing {start}–{end} of {filtered.length}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Rows per page
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                className="h-8 rounded-md border border-input bg-white px-2 text-sm text-foreground"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">Page {activePage} of {totalPages}</span>
            <Button
              variant="outline" size="icon-sm" title="Previous page" aria-label="Previous page"
              disabled={activePage <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            ><ArrowLeft className="size-4" /></Button>
            <Button
              variant="outline" size="icon-sm" title="Next page" aria-label="Next page"
              disabled={activePage >= totalPages || loading}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            ><ArrowRight className="size-4" /></Button>
          </div>
        </div>
      </section>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!saving) setEditOpen(open); }}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription>{editingId ? "Update the employee's information." : "Add an employee to the directory for schedule assignments."}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
            {employeeConfig.fields.map((field) => (
              <div key={field.key} className={"space-y-2" + (field.key === "remarks" ? " sm:col-span-2" : "")}>
                <Label htmlFor={"employee-" + field.key}>{field.label}{field.required ? " *" : ""}</Label>
                {field.key === "remarks" ? (
                  <Textarea
                    id={"employee-" + field.key}
                    rows={2}
                    maxLength={5000}
                    value={draft.remarks ?? ""}
                    onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))}
                  />
                ) : field.key === "status" ? (
                  <select
                    id="employee-status"
                    required
                    value={draft.status ?? "Active"}
                    onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  >
                    {employeeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                ) : (
                  <Input
                    id={"employee-" + field.key}
                    type={field.type || "text"}
                    required={field.required}
                    maxLength={200}
                    value={draft[field.key] ?? ""}
                    placeholder={field.placeholder}
                    onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
                  />
                )}
              </div>
            ))}
            {formError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{formError}</p>}
            <div className="sm:col-span-2">
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving} onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add Employee"}</Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete employee</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name || deleteTarget?.employeeCode || "this employee"}? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={deleteEmployee}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
