import type ExcelJS from "exceljs";
import type { CatalogKind } from "@/lib/catalog";
import { catalogConfigs } from "@/lib/catalog-config";

export type ImportRow = { rowNumber: number; data: Record<string, string> };
export type ParsedExcel = { sheetName: string; rows: ImportRow[]; headers: string[] };

export const MAX_EXCEL_ROWS = 1000;
export const MAX_EXCEL_BYTES = 5 * 1024 * 1024;

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

const headerAliases: Record<string, string[]> = {
  contractValue: ["Contract Value", "Contract Vaue"],
  descriptions: ["Description", "Descriptions"],
  soNo: ["SO No", "S.O. No", "So No"],
  registrationNo: ["Registration Number", "Registration No"],
  employeeCode: ["Employee Number", "Employee ID"],
  projectInCharge: ["Project In-Charge", "Project In Charge"],
};

function extractValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("").trim();
  }
  if ("text" in value && typeof value.text === "string") return value.text.trim();
  if ("result" in value && value.result !== undefined && value.result !== null) {
    return extractValue(value.result as ExcelJS.CellValue);
  }
  return "";
}

function normalizeJoiningDate(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    // Excel serial date numbers: account for Excel's 1900 leap-year convention.
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
  }
  const text = extractValue(value);
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(text);
  if (iso) return iso[1] + "-" + iso[2].padStart(2, "0") + "-" + iso[3].padStart(2, "0");
  // Imported day-first dates follow the commonly used DD/MM/YYYY convention.
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (dayFirst) return dayFirst[3] + "-" + dayFirst[2].padStart(2, "0") + "-" + dayFirst[1].padStart(2, "0");
  return text;
}

export async function parseCatalogExcel(file: File, kind: CatalogKind): Promise<ParsedExcel> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error("Choose an .xlsx Excel file.");
  if (!file.size || file.size > MAX_EXCEL_BYTES) {
    throw new Error("Choose an Excel file smaller than 5 MB.");
  }

  // ExcelJS runs in the browser and does not upload files to any external service.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const data = new Uint8Array(await file.arrayBuffer());
  await workbook.xlsx.load(data as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const fields = catalogConfigs[kind].fields;
  const mapAliases = new Map<string, string>();
  for (const field of fields) {
    for (const heading of [field.label, ...(headerAliases[field.key] ?? [])]) {
      mapAliases.set(normalize(heading), field.key);
    }
  }

  let selected: ExcelJS.Worksheet | undefined;
  let headerRow = 0;
  let indexes = new Map<string, number>();
  let best = new Map<string, number>();

  for (const sheet of workbook.worksheets) {
    for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 25); rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const found = new Map<string, number>();
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        const field = mapAliases.get(normalize(extractValue(cell.value)));
        if (field && !found.has(field)) found.set(field, column);
      });

      if (found.size > best.size) best = found;
      if (found.size === fields.length) {
        selected = sheet;
        headerRow = rowNumber;
        indexes = found;
        break;
      }
    }
    if (selected) break;
  }

  if (!selected) {
    const missing = fields.filter((field) => !best.has(field.key)).map((field) => field.label);
    throw new Error("Missing Excel column headers: " + missing.join(", ") + ". Download the template for the expected format.");
  }

  const rows: ImportRow[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= selected.rowCount; rowNumber++) {
    const worksheetRow = selected.getRow(rowNumber);
    const record: Record<string, string> = {};
    for (const field of fields) {
      const index = indexes.get(field.key);
      const value = index === undefined ? null : worksheetRow.getCell(index).value;
      record[field.key] = field.key === "joiningDate" ? normalizeJoiningDate(value) : extractValue(value);
    }
    if (Object.values(record).every((value) => value === "")) continue;
    rows.push({ rowNumber, data: record });
    if (rows.length > MAX_EXCEL_ROWS) {
      throw new Error("This file has more than 1,000 records. Split it into smaller files and import each one.");
    }
  }

  if (rows.length === 0) throw new Error("No data rows were found below the Excel headers.");
  return { sheetName: selected.name, rows, headers: fields.map((field) => field.label) };
}

export async function downloadCatalogTemplate(kind: CatalogKind): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(catalogConfigs[kind].title);
  const fields = catalogConfigs[kind].fields;
  sheet.addRow(fields.map((field) => field.label));
  sheet.getRow(1).height = 28;
  fields.forEach((field, index) => {
    sheet.getColumn(index + 1).width =
      ["descriptions", "remarks", "paymentTerms"].includes(field.key) ? 38 : 23;
    const cell = sheet.getCell(1, index + 1);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF20262E" } };
    cell.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
    if (["jobNo", "employeeCode", "registrationNo", "soNo", "rev"].includes(field.key)) {
      sheet.getColumn(index + 1).numFmt = "@";
    }
    if (field.key === "joiningDate") sheet.getColumn(index + 1).numFmt = "yyyy-mm-dd";
  });
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = kind + "-import-template.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
