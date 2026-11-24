import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";
import { siteReportInput } from "@/lib/validation";
import {
  DUPLICATE_REPORT_MESSAGE, equipmentRows, labourRows, siteReportDto, siteReportInclude,
} from "@/lib/site-report-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const report = await getPrisma().siteDailyReport.findUnique({ where: { id }, include: siteReportInclude });
    if (!report) return NextResponse.json({ error: "Site daily report not found." }, { status: 404 });
    return NextResponse.json(siteReportDto(report));
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const input = siteReportInput.parse(await parseJson(request));
    const report = await getPrisma().siteDailyReport.update({
      where: { id },
      data: {
        projectId: input.projectId,
        date: input.date,
        activityDescription: input.activityDescription,
        remarks: input.remarks,
        labours: { deleteMany: {}, create: labourRows(input) },
        equipments: { deleteMany: {}, create: equipmentRows(input) },
      },
      include: siteReportInclude,
    });
    return NextResponse.json(siteReportDto(report));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: DUPLICATE_REPORT_MESSAGE }, { status: 409 });
    }
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    await getPrisma().siteDailyReport.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
