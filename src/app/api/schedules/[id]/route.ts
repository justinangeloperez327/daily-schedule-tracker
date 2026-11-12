import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { scheduleDto, scheduleInclude } from "@/lib/schedule-server";
import { scheduleInput } from "@/lib/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const data = scheduleInput.parse(await parseJson(request));
    const row = await getPrisma().schedule.update({
      where: { id },
      data: {
        date: data.date,
        jobNo: data.jobNo,
        timeIn: data.timeIn,
        timeOut: data.timeOut,
        scope: data.scope,
        project: { connect: { id: data.projectId } },
        employees: {
          deleteMany: {},
          create: data.employeeIds.map((employeeId) => ({ employee: { connect: { id: employeeId } } })),
        },
        equipments: {
          deleteMany: {},
          create: data.equipmentIds.map((equipmentId) => ({ equipment: { connect: { id: equipmentId } } })),
        },
      },
      include: scheduleInclude,
    });
    return NextResponse.json(scheduleDto(row));
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await getPrisma().schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
