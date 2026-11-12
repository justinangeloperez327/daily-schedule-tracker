"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { CatalogKind } from "@/lib/catalog";
import { catalogConfigs } from "@/lib/catalog-config";
import { apiRequest } from "@/lib/http";
import type { ParsedExcel } from "@/lib/import-excel";

export type ImportResult = { created: number; skipped: number; total: number; message: string };

export function ImportExcelDialog({
  kind,
  onImported,
}: {
  kind: CatalogKind;
  onImported: (result: ImportResult) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<ParsedExcel | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [templateLoading, setTemplateLoading] = React.useState(false);
  const config = catalogConfigs[kind];
  const identity = config.identity;

  function reset() {
    setFile(null);
    setPreview(null);
    setError("");
    setLoading(false);
  }

  async function prepare() {
    if (!file || loading || importing) return;
    setLoading(true);
    setError("");
    setPreview(null);
    try {
      const { parseCatalogExcel } = await import("@/lib/import-excel");
      const parsed = await parseCatalogExcel(file, kind);
      setPreview(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read the selected Excel file.");
    } finally {
      setLoading(false);
    }
  }

  async function importRows() {
    if (!preview || importing) return;
    setImporting(true);
    setError("");
    try {
      const result = await apiRequest<ImportResult>("/api/import/" + kind, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
      });
      await onImported(result);
      setOpen(false);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import failed. No records were imported.");
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    if (templateLoading) return;
    setTemplateLoading(true);
    setError("");
    try {
      const { downloadCatalogTemplate } = await import("@/lib/import-excel");
      await downloadCatalogTemplate(kind);
    } catch {
      setError("Unable to prepare the Excel template.");
    } finally {
      setTemplateLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="h-10 px-4" onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Import Excel
      </Button>
      <Dialog open={open} onOpenChange={(next) => {
        if (!loading && !importing) {
          setOpen(next);
          if (!next) reset();
        }
      }}>
        <DialogContent className="sm:max-w-[660px]">
          <DialogHeader>
            <DialogTitle>Import {config.title} from Excel</DialogTitle>
            <DialogDescription>
              Upload an .xlsx file with the expected column headers. Review the records before adding them to PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm">
              <p className="font-medium">Expected columns ({config.fields.length})</p>
              <p className="mt-2 leading-6 text-muted-foreground">
                {config.fields.map((field) => field.label).join(" · ")}
              </p>
              <Button
                size="sm" variant="outline" className="mt-3"
                onClick={downloadTemplate} disabled={templateLoading || importing}
              >
                <Download className="size-4" />
                {templateLoading ? "Preparing template..." : "Download Excel template"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor={"import-file-" + kind}>Excel workbook (.xlsx only)</Label>
              <input
                id={"import-file-" + kind}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={loading || importing}
                onChange={(event) => {
                  const next = event.target.files?.[0] ?? null;
                  setFile(next);
                  setPreview(null);
                  setError("");
                }}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Maximum 5 MB and 1,000 rows per file. Dates: YYYY-MM-DD or DD/MM/YYYY.
              </p>
            </div>

            {!preview && (
              <Button variant="secondary" onClick={prepare} disabled={!file || loading || importing}>
                <FileSpreadsheet />
                {loading ? "Reading Excel..." : "Preview file"}
              </Button>
            )}

            {preview && (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">Ready to import {preview.rows.length} rows</p>
                    <p className="text-xs text-muted-foreground">Worksheet: {preview.sheetName}</p>
                  </div>
                  <Button size="sm" variant="ghost" disabled={importing} onClick={() => setPreview(null)}>
                    Choose another
                  </Button>
                </div>
                <div className="max-h-44 overflow-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Excel row</th>
                        <th className="px-3 py-2 font-semibold">{config.fields.find((f) => f.key === identity)?.label}</th>
                        <th className="px-3 py-2 font-semibold">Description / Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 5).map((row) => (
                        <tr key={row.rowNumber} className="border-t border-border">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">{row.data[identity] || "—"}</td>
                          <td className="max-w-64 truncate px-3 py-2">
                            {row.data[kind === "projects" ? "name" : kind === "employees" ? "name" : "vehicleDetails"] || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Previewing up to 5 records. Every valid row will be added, even when it has the same identifiers or values as an existing record. Delete unwanted rows from the table afterward.
                </p>
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={loading || importing} onClick={() => { setOpen(false); reset(); }}>
              Cancel
            </Button>
            <Button disabled={!preview || loading || importing} onClick={importRows}>
              <Upload className="size-4" />
              {importing ? "Importing..." : "Confirm import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
