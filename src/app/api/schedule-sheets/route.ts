import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { scheduleSheetInput } from "@/lib/validation";
import { sheetDto, sheetInclude, sheetSummary, summaryDto } from "@/lib/schedule-sheet-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sheets = await getPrisma().scheduleSheet.findMany({
      include: sheetSummary,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(sheets.map(summaryDto));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const data = scheduleSheetInput.parse(await parseJson(request));
    const sheet = await getPrisma().scheduleSheet.create({
      data: {
        date: data.date,
        dispatches: {
          create: data.dispatches.map((entry, index) => ({
            date: data.date,
            jobNo: "",
            project: { connect: { id: entry.projectId } },
            sortOrder: index,
            shift: entry.shift,
            scope: entry.scope,
            campStart: entry.campStart,
            timeIn: entry.timeIn,
            timeOut: entry.timeOut,
            employees: { create: entry.employeeIds.map((id) => ({ employee: { connect: { id } } })) },
            foremen: { create: entry.foremanIds.map((id) => ({ employee: { connect: { id } } })) },
            equipments: { create: entry.equipmentIds.map((id) => ({ equipment: { connect: { id } } })) },
          })),
        },
      },
      include: sheetInclude,
    });
    return NextResponse.json(sheetDto(sheet), { status: 201 });
  } catch (error) { return apiError(error); }
}
