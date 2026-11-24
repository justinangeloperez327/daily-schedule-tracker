import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { apiError, parseJson } from "@/lib/api-response";
import { dailyScheduleInput } from "@/lib/validation";
import { scheduleDto, scheduleInclude, scheduleSummaryInclude, scheduleSummaryDto } from "@/lib/schedule-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const schedules = await getPrisma().schedule.findMany({
      include: scheduleSummaryInclude,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(schedules.map(scheduleSummaryDto));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const input = dailyScheduleInput.parse(await parseJson(request));
    const schedule = await getPrisma().schedule.create({
      data: {
        date: input.date,
        jobs: {
          create: input.jobs.map((job, index) => ({
            date: input.date,
            jobNo: "",
            project: { connect: { id: job.projectId } },
            sortOrder: index,
            shift: job.shift,
            scope: job.scope,
            dailyTarget: job.dailyTarget,
            campStart: job.campStart,
            timeIn: job.timeIn,
            timeOut: job.timeOut,
            foremen: { create: job.foremanIds.map((id) => ({ employee: { connect: { id } } })) },
            labours: { create: job.employeeIds.map((id) => ({ employee: { connect: { id } } })) },
            equipments: { create: job.equipmentIds.map((id) => ({ equipment: { connect: { id } } })) },
          })),
        },
      },
      include: scheduleInclude,
    });
    return NextResponse.json(scheduleDto(schedule), { status: 201 });
  } catch (error) { return apiError(error); }
}
