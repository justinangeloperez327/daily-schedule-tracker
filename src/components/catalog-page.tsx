"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ImportExcelDialog, type ImportResult } from "@/components/import-excel-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { SortableTableHead, type TableSortDirection } from "@/components/ui/sortable-table-head";
import { compareTableValues } from "@/lib/table-sort";
import { RowActionsMenu } from "@/components/ui/row-actions-menu";
import type { CatalogKind } from "@/lib/catalog";
import { catalogConfigs, emptyCatalogDraft } from "@/lib/catalog-config";
import { apiRequest } from "@/lib/http";

type CatalogRow = { id: string; [key: string]: unknown };

// Keep these project values in the database, forms and Excel workflows.
// Hiding them is a directory-display decision only.
const hiddenProjectColumns = new Set(["rev", "paymentTerms", "contractValue", "soNo", "descriptions"]);

function getValue(record: CatalogRow, key: string): string {
  const value = record[key];
  return value === null || value === undefined ? "" : String(value);
}

export function CatalogPage({ kind }: { kind: CatalogKind }) {
  const config = catalogConfigs[kind];
  const [records, setRecords] = React.useState<CatalogRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [density, setDensity] = React.useState<"comfortable" | "compact">("comfortable");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [sort, setSort] = React.useState<{ key: string; direction: TableSortDirection }>(() => ({
    key: kind === "equipments" ? "vehicleDetails" : "name",
    direction: "asc",
  }));
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<CatalogRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Record<string, string>>(() => emptyCatalogDraft(kind));

  const loadRecords = React.useCallback(async () => {
    const result = await apiRequest<CatalogRow[]>("/api/" + kind);
    setRecords(result);
    setError("");
  }, [kind]);

  React.useEffect(() => {
    let alive = true;
    apiRequest<CatalogRow[]>("/api/" + kind)
      .then((items) => { if (alive) setRecords(items); })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : "Unable to load records.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind]);

  const matches = records
    .filter((record) =>
      !query.trim() || config.fields.some(
        (field) => getValue(record, field.key).toLowerCase().includes(query.trim().toLowerCase())
      )
    )
    .sort((a, b) =>
      compareTableValues(getValue(a, sort.key), getValue(b, sort.key), sort.direction) ||
      compareTableValues(getValue(a, "name") || getValue(a, "vehicleDetails"), getValue(b, "name") || getValue(b, "vehicleDetails"), "asc") ||
      compareTableValues(a.id, b.id, "asc")
    );
  const visibleFields = kind === "projects"
    ? config.fields.filter((field) => !hiddenProjectColumns.has(field.key))
    : config.fields;
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = matches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function sortBy(key: string) {
    setSort((previous) => ({
      key,
      direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  }

  function addNew() {
    setEditingId(null);
    setDraft(emptyCatalogDraft(kind));
    setFormError("");
    setDialogOpen(true);
  }

  function edit(record: CatalogRow) {
    setEditingId(record.id);
    setDraft(Object.fromEntries(config.fields.map((field) => [field.key, getValue(record, field.key)])));
    setFormError("");
    setDialogOpen(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");

    const payload: Record<string, string> = {};
    for (const field of config.fields) payload[field.key] = (draft[field.key] ?? "").trim();

    try {
      const record = await apiRequest<CatalogRow>(
        "/api/" + kind + (editingId ? "/" + encodeURIComponent(editingId) : ""),
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setRecords((current) => {
        const updated = editingId
          ? current.map((item) => item.id === editingId ? record : item)
          : [...current, record];
        const sortKey = kind === "equipments" ? "vehicleDetails" : "name";
        return [...updated].sort((a, b) => getValue(a, sortKey).localeCompare(getValue(b, sortKey)));
      });
      setError("");
      setNotice("");
      setDialogOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Unable to save record.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const id = deleteTarget.id;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiRequest<{ success: true }>("/api/" + kind + "/" + encodeURIComponent(id), {
        method: "DELETE",
      });
      setRecords((current) => current.filter((item) => item.id !== id));
      setError("");
      setDeleteTarget(null);
      setNotice(config.singular + " deleted.");
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Unable to delete record.");
    } finally {
      setDeleting(false);
    }
  }

  async function onImported(result: ImportResult) {
    setNotice("Excel import complete: " + result.created + " of " + result.total + " rows added, including any duplicates.");
    try {
      await loadRecords();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Imported records, but unable to reload the table.");
    }
  }

  return (
    <main className="w-full min-w-0 max-w-none px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-12">
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:flex-wrap sm:items-center">
        <div>
          <p className="technical-eyebrow mb-1.5">{"MASTER DATA / " + config.title.toUpperCase()}</p>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-primary sm:text-[32px]">
            {config.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <ImportExcelDialog kind={kind} onImported={onImported} />
          <Button className="h-10" onClick={addNew}>
            <Plus /> Add {config.singular}
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mb-4 text-sm text-foreground">{notice}</p>}
      <section className="min-w-0 rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
        <div className="flex flex-col items-stretch justify-between gap-3 border-b border-border px-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-6">
          <div>
            <h2 className="text-base font-semibold">{config.title} directory</h2>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              {matches.length} {matches.length === 1 ? "record" : "records"}
              {query.trim() && <span> matching search · {records.length} total</span>}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative w-full min-w-0 sm:w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              aria-label={"Search " + config.title.toLowerCase()}
              value={query}
              placeholder={"Search " + config.title.toLowerCase() + "..."}
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Density
            <select
              value={density}
              onChange={(event) => setDensity(event.target.value as "comfortable" | "compact")}
              aria-label={config.title + " table density"}
              className="h-9 rounded-md border border-input bg-white px-2 text-sm text-foreground"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          </div>
        </div>
        <p className="px-3 py-2 text-xs text-muted-foreground sm:hidden">
          Scroll the table sideways to view all columns.
        </p>
        <Table className={kind === "projects" ? "min-w-[1240px] table-auto" : "min-w-[960px] table-auto"}>
          <TableHeader className="bg-[#f0f5fa]">
            <TableRow className="h-9">
              {visibleFields.map((field) => (
                <SortableTableHead
                  key={field.key}
                  label={field.label}
                  direction={sort.key === field.key ? sort.direction : undefined}
                  onSort={() => sortBy(field.key)}
                  className={["name", "clientName", "vehicleDetails", "remarks", "projectInCharge"].includes(field.key)
                    ? "h-9 min-w-[220px] px-4 py-1.5"
                    : "h-9 min-w-[116px] px-4 py-1.5"}
                />
              ))}
              <TableHead className="h-9 w-[78px] min-w-[78px] px-4 py-1.5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && visibleRows.map((record) => (
              <TableRow key={record.id} className={density === "comfortable" ? "h-9" : "h-8"}>
                {visibleFields.map((field) => (
                  <TableCell
                    key={field.key}
                    className={(density === "comfortable" ? "py-0.5" : "py-0") +
                      (kind === "projects"
                        ? " min-w-[135px] max-w-[400px] px-4 align-top text-sm leading-5 text-[#50677F]"
                        : " min-w-[116px] max-w-[360px] px-4 align-middle text-sm leading-5 text-[#50677F]")}
                    title={getValue(record, field.key)}
                  >
                    {kind === "projects" ? (
                      field.key === "name" ? (
                        <Link
                          href={"/projects/" + encodeURIComponent(record.id)}
                          className="block whitespace-pre-wrap break-words font-semibold text-primary underline-offset-2 hover:underline [overflow-wrap:anywhere]"
                        >
                          {getValue(record, field.key) || "—"}
                        </Link>
                      ) : (
                        <span className={"block whitespace-pre-wrap break-words [overflow-wrap:anywhere]" +
                          (["soNo", "jobNo"].includes(field.key) ? " font-mono text-[#365F91]" : "")}>
                          {getValue(record, field.key) || "—"}
                        </span>
                      )
                    ) : (
                      <span className="block max-w-[340px] truncate">
                        {getValue(record, field.key) || "—"}
                      </span>
                    )}
                  </TableCell>
                ))}
                <TableCell className={(density === "comfortable" ? "py-0.5" : "py-0") + " px-3.5 align-top"}>
                  <div className="flex justify-end">
                    <RowActionsMenu
                      itemName={getValue(record, "name") || getValue(record, "vehicleDetails") || record.id}
                      viewHref={kind === "projects" ? "/projects/" + encodeURIComponent(record.id) : undefined}
                      onEdit={() => edit(record)}
                      onDelete={() => { setDeleteTarget(record); setDeleteError(""); }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(loading || matches.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleFields.length + 1} className="py-16 text-center">
                  <div className="mx-auto flex flex-col items-center text-muted-foreground">
                    <ClipboardList className="mb-3 size-6" />
                    <p className="text-sm">
                      {loading ? "Loading records..." : query ? "No matching records" : "No records yet"}
                    </p>
                    {!loading && !query && <p className="mt-1 text-xs">Use Add {config.singular} or Import Excel to get started.</p>}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={matches.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          disabled={loading}
        />
      </section>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null);
            setDeleteError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {config.singular.toLowerCase()}</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget && (
                getValue(deleteTarget, "name") || getValue(deleteTarget, "vehicleDetails") || deleteTarget.id
              )}? This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(next) => { if (!saving) setDialogOpen(next); }}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} {config.singular.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update the existing record." : "Create a record that can be used in schedules."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            {config.fields.map((field) => {
              const isLong = ["descriptions", "paymentTerms", "remarks"].includes(field.key);
              return (
                <div key={field.key} className={"space-y-2 " + (isLong ? "sm:col-span-2" : "")}>
                  <Label htmlFor={field.key}>{field.label}{field.required ? " *" : ""}</Label>
                  {isLong ? (
                    <Textarea
                      id={field.key}
                      value={draft[field.key] ?? ""}
                      maxLength={5000}
                      placeholder={field.placeholder}
                      rows={2}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      id={field.key}
                      type={field.type ?? "text"}
                      value={draft[field.key] ?? ""}
                      required={field.required}
                      maxLength={200}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    />
                  )}
                </div>
              );
            })}
            {formError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{formError}</p>}
            <div className="sm:col-span-2">
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving} onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingId ? "Save changes" : "Add " + config.singular}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
