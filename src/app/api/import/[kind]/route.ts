import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { employeeInput, equipmentInput, projectInput } from "@/lib/validation";
import type { CatalogKind } from "@/lib/catalog";

export const runtime = "nodejs";
type Context = { params: Promise<{ kind: string }> };

const batchSchema = z.object({
  rows: z.array(z.object({
    rowNumber: z.number().int().positive(),
    data: z.record(z.string(), z.string()),
  }).strict()).min(1).max(1000),
}).strict();

export async function POST(request: Request, context: Context) {
  try {
    const { kind } = await context.params;
    if (kind !== "projects" && kind !== "employees" && kind !== "equipments") {
      return NextResponse.json({ error: "Invalid import category." }, { status: 404 });
    }

    const batch = batchSchema.parse(await parseJson(request));
    const parsed = parseRows(kind, batch.rows);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const prisma = getPrisma();
    let created = 0;

    // Each valid Excel row is inserted as its own record. Duplicates are permitted.
    // Keep one createMany per import for transaction-level all-or-nothing behavior.
    if (kind === "projects") {
      created = (await prisma.project.createMany({ data: parsed.projects })).count;
    } else if (kind === "employees") {
      created = (await prisma.employee.createMany({ data: parsed.employees })).count;
    } else {
      created = (await prisma.equipment.createMany({ data: parsed.equipments })).count;
    }

    return NextResponse.json({
      created,
      skipped: 0,
      total: batch.rows.length,
      message: "All valid rows were imported, including duplicate records.",
    });
  } catch (error) {
    return apiError(error);
  }
}

type InputRow = { rowNumber: number; data: Record<string, string> };
type ParsedRows = {
  projects: z.infer<typeof projectInput>[];
  employees: z.infer<typeof employeeInput>[];
  equipments: z.infer<typeof equipmentInput>[];
  error: string;
};

function parseRows(kind: CatalogKind, rows: InputRow[]): ParsedRows {
  const result: ParsedRows = { projects: [], employees: [], equipments: [], error: "" };

  for (const row of rows) {
    if (kind === "projects") {
      const parsed = projectInput.safeParse(row.data);
      if (!parsed.success) return rowError(result, row.rowNumber, parsed.error);
      result.projects.push(parsed.data);
    } else if (kind === "employees") {
      const parsed = employeeInput.safeParse(row.data);
      if (!parsed.success) return rowError(result, row.rowNumber, parsed.error);
      result.employees.push(parsed.data);
    } else {
      const parsed = equipmentInput.safeParse(row.data);
      if (!parsed.success) return rowError(result, row.rowNumber, parsed.error);
      result.equipments.push(parsed.data);
    }
  }

  return result;
}

function rowError(result: ParsedRows, rowNumber: number, error: z.ZodError): ParsedRows {
  const issue = error.issues[0];
  const field = issue.path.length ? issue.path.join(".") + ": " : "";
  return { ...result, error: "Excel row " + rowNumber + ": " + field + issue.message };
}
