"use client";

import * as React from "react";
import { ClipboardList, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ImportExcelDialog, type ImportResult } from "@/components/import-excel-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CatalogKind } from "@/lib/catalog";
import { catalogConfigs, emptyCatalogDraft } from "@/lib/catalog-config";
import { apiRequest } from "@/lib/http";

type CatalogRow = { id: string; [key: string]: unknown };

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
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [formError, setFormError] = React.useState("");
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

  const matches = records.filter((record) =>
    !query.trim() || config.fields.some(
      (field) => getValue(record, field.key).toLowerCase().includes(query.trim().toLowerCase())
    )
  );

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

  async function remove(record: CatalogRow) {
    const title = getValue(record, "name") || getValue(record, "vehicleDetails") || getValue(record, "employeeCode") || record.id;
    if (!window.confirm("Delete " + title + "? This cannot be undone.")) return;
    try {
      await apiRequest<{ success: true }>("/api/" + kind + "/" + encodeURIComponent(record.id), {
        method: "DELETE",
      });
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete record.");
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
    <main className="mx-auto max-w-[1500px] px-5 pb-16 pt-9 sm:px-8 lg:px-10 lg:pt-12">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] sm:text-[32px]">
            {config.title}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExcelDialog kind={kind} onImported={onImported} />
          <Button className="h-10" onClick={addNew}>
            <Plus /> Add {config.singular}
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mb-4 text-sm text-foreground">{notice}</p>}
      <section className="rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">{config.title} directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {records.length} {records.length === 1 ? "record" : "records"}
            </p>
          </div>
          <div className="relative w-full sm:w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              aria-label={"Search " + config.title.toLowerCase()}
              value={query}
              placeholder={"Search " + config.title.toLowerCase() + "..."}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <Table className={kind === "projects" ? "min-w-[1850px]" : "min-w-[1080px]"}>
          <TableHeader className="bg-[#f8f9fa]">
            <TableRow>
              {config.fields.map((field) => <TableHead key={field.key} className="px-5">{field.label}</TableHead>)}
              <TableHead className="w-24 pr-5 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && matches.map((record) => (
              <TableRow key={record.id}>
                {config.fields.map((field) => (
                  <TableCell
                    key={field.key}
                    className="max-w-[280px] truncate px-5 text-[#545b64]"
                    title={getValue(record, field.key)}
                  >
                    {getValue(record, field.key) || "—"}
                  </TableCell>
                ))}
                <TableCell className="pr-5">
                  <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label={"Edit record " + record.id} onClick={() => edit(record)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label={"Delete record " + record.id} onClick={() => remove(record)}>
                      <Trash2 className="size-3.5" /> Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(loading || matches.length === 0) && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={config.fields.length + 1} className="py-16 text-center">
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
      </section>

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
