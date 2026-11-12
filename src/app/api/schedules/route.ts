import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { scheduleDto, scheduleInclude } from "@/lib/schedule-server";
import { scheduleInput, scheduleDate } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const date = scheduleDate.parse(new URL(request.url).searchParams.get("date"));
    const rows = await getPrisma().schedule.findMany({
      where: { date },
      include: scheduleInclude,
      orderBy: [{ timeIn: "asc" }, { jobNo: "asc" }],
    });
    return NextResponse.json(rows.map(scheduleDto));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const data = scheduleInput.parse(await parseJson(request));
    const row = await getPrisma().schedule.create({
      data: {
        date: data.date,
        jobNo: data.jobNo,
        timeIn: data.timeIn,
        timeOut: data.timeOut,
        scope: data.scope,
        project: { connect: { id: data.projectId } },
        employees: { create: data.employeeIds.map((id) => ({ employee: { connect: { id } } })) },
        equipments: { create: data.equipmentIds.map((id) => ({ equipment: { connect: { id } } })) },
      },
      include: scheduleInclude,
    });
    return NextResponse.json(scheduleDto(row), { status: 201 });
  } catch (error) { return apiError(error); }
}
