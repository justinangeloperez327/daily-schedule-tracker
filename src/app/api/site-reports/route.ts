import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { siteReportInput } from "@/lib/validation";
import {
  equipmentRows, labourRows, siteReportDto, siteReportInclude,
  siteReportSummaryDto, siteReportSummaryInclude,
} from "@/lib/site-report-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const reports = await getPrisma().siteDailyReport.findMany({
      include: siteReportSummaryInclude,
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    });
    return NextResponse.json(reports.map(siteReportSummaryDto));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = siteReportInput.parse(await parseJson(request));
    const report = await getPrisma().siteDailyReport.create({
      data: {
        projectId: input.projectId,
        date: input.date,
        activityDescription: input.activityDescription,
        remarks: input.remarks,
        createdById: user.id,
        labours: { create: labourRows(input) },
        equipments: { create: equipmentRows(input) },
      },
      include: siteReportInclude,
    });
    return NextResponse.json(siteReportDto(report), { status: 201 });
  } catch (error) { return apiError(error); }
}
