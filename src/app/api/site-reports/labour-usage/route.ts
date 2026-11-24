import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { scheduleDate } from "@/lib/validation";
import type { LabourUsage } from "@/lib/site-report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Employees already reported on a date, used to warn about double entry.
// ?date=YYYY-MM-DD&exclude=<reportId being edited>
export async function GET(request: Request) {
  try {
    await requireUser();
    const params = new URL(request.url).searchParams;
    const date = scheduleDate.parse(params.get("date"));
    const exclude = params.get("exclude") || undefined;
    const rows = await getPrisma().siteReportLabour.findMany({
      where: { report: { date, ...(exclude ? { id: { not: exclude } } : {}) } },
      select: {
        employeeId: true, timeIn: true, timeOut: true,
        report: { select: { id: true, project: { select: { jobNo: true, name: true } } } },
      },
    });
    const usage: LabourUsage[] = rows.map((row) => ({
      employeeId: row.employeeId,
      reportId: row.report.id,
      jobNo: row.report.project.jobNo || row.report.project.name || "another job",
      timeIn: row.timeIn,
      timeOut: row.timeOut,
    }));
    return NextResponse.json(usage);
  } catch (error) { return apiError(error); }
}
