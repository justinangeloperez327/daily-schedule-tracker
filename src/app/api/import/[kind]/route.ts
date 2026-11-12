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

    if (kind === "projects") {
      const result = await prisma.project.createMany({ data: parsed.projects, skipDuplicates: true });
      created = result.count;
    } else if (kind === "employees") {
      const result = await prisma.employee.createMany({ data: parsed.employees, skipDuplicates: true });
      created = result.count;
    } else {
      const result = await prisma.equipment.createMany({ data: parsed.equipments, skipDuplicates: true });
      created = result.count;
    }

    return NextResponse.json({
      created,
      skipped: batch.rows.length - created,
      total: batch.rows.length,
      message: "Existing records with the same identifier were skipped, not overwritten.",
    });
  } catch (error) {
    return apiError(error);
  }
}

type InputRow = { rowNumber: number; data: Record<string, string> };

function parseRows(kind: CatalogKind, rows: InputRow[]) {
  const projects: z.infer<typeof projectInput>[] = [];
  const employees: z.infer<typeof employeeInput>[] = [];
  const equipments: z.infer<typeof equipmentInput>[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const validation =
      kind === "projects" ? projectInput.safeParse(row.data) :
      kind === "employees" ? employeeInput.safeParse(row.data) :
      equipmentInput.safeParse(row.data);

    if (!validation.success) {
      const issue = validation.error.issues[0];
      const field = issue.path.length ? issue.path.join(".") + ": " : "";
      return { projects, employees, equipments, error: "Excel row " + row.rowNumber + ": " + field + issue.message };
    }

    let identifier = "";
    if (kind === "projects" && validation.data && "jobNo" in validation.data) {
      if (!validation.data.jobNo) {
        return { projects, employees, equipments, error: "Excel row " + row.rowNumber + ": Job No is required for imports." };
      }
      identifier = validation.data.jobNo.toLowerCase() + "::" + validation.data.rev.toLowerCase();
      projects.push(validation.data);
    } else if (kind === "employees" && validation.data && "employeeCode" in validation.data) {
      if (!validation.data.employeeCode) {
        return { projects, employees, equipments, error: "Excel row " + row.rowNumber + ": Employee ID is required for imports." };
      }
      identifier = validation.data.employeeCode.toLowerCase();
      employees.push(validation.data);
    } else if (kind === "equipments" && validation.data && "registrationNo" in validation.data) {
      if (!validation.data.registrationNo) {
        return { projects, employees, equipments, error: "Excel row " + row.rowNumber + ": Registration No is required for imports." };
      }
      identifier = validation.data.registrationNo.toLowerCase();
      equipments.push(validation.data);
    }

    if (seen.has(identifier)) {
      return { projects, employees, equipments, error: "Excel row " + row.rowNumber + ": duplicate identifier within this file." };
    }
    seen.add(identifier);
  }
  return { projects, employees, equipments, error: "" };
}
