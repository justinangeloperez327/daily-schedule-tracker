import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { apiError, parseJson } from "@/lib/api-response";
import { dailyScheduleInput } from "@/lib/validation";
import { scheduleDto, scheduleInclude } from "@/lib/schedule-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const schedule = await getPrisma().schedule.findUnique({ where: { id }, include: scheduleInclude });
    if (!schedule) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    return NextResponse.json(scheduleDto(schedule));
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const input = dailyScheduleInput.parse(await parseJson(request));
    const prisma = getPrisma();

    const schedule = await prisma.$transaction(async (tx) => {
      const existingJobs = await tx.scheduleJob.findMany({
        where: { scheduleId: id },
        select: { id: true },
      });
      const existingJobIds = new Set(existingJobs.map((job) => job.id));
      const retainedIds = input.jobs.flatMap((job) => job.id ? [job.id] : []);
      if (retainedIds.some((jobId) => !existingJobIds.has(jobId))) {
        throw new Error("A job does not belong to this schedule.");
      }

      await tx.schedule.update({ where: { id }, data: { date: input.date } });
      await tx.scheduleJob.deleteMany({
        where: { scheduleId: id, id: { notIn: retainedIds } },
      });

      for (const [index, job] of input.jobs.entries()) {
        const fields = {
          date: input.date,
          sortOrder: index,
          shift: job.shift,
          scope: job.scope,
          dailyTarget: job.dailyTarget,
          campStart: job.campStart,
          timeIn: job.timeIn,
          timeOut: job.timeOut,
          projectId: job.projectId,
        };

        if (job.id) {
          await tx.scheduleJob.update({
            where: { id: job.id },
            data: {
              ...fields,
              foremen: {
                deleteMany: {},
                create: job.foremanIds.map((employeeId) => ({ employeeId })),
              },
              labours: {
                deleteMany: {},
                create: job.employeeIds.map((employeeId) => ({ employeeId })),
              },
              equipments: {
                deleteMany: {},
                create: job.equipmentIds.map((equipmentId) => ({ equipmentId })),
              },
            },
          });
        } else {
          await tx.scheduleJob.create({
            data: {
              ...fields,
              scheduleId: id,
              jobNo: "",
              foremen: { create: job.foremanIds.map((employeeId) => ({ employeeId })) },
              labours: { create: job.employeeIds.map((employeeId) => ({ employeeId })) },
              equipments: { create: job.equipmentIds.map((equipmentId) => ({ equipmentId })) },
            },
          });
        }
      }
      return tx.schedule.findUniqueOrThrow({ where: { id }, include: scheduleInclude });
    });
    return NextResponse.json(scheduleDto(schedule));
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    await getPrisma().schedule.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
