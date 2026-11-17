import type { Prisma } from "@/generated/prisma/client";

export const scheduleInclude = {
  jobs: {
    include: {
      project: true,
      foremen: { include: { employee: true } },
      labours: { include: { employee: true } },
      equipments: { include: { equipment: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.ScheduleInclude;

export type ScheduleRecord = Prisma.ScheduleGetPayload<{ include: typeof scheduleInclude }>;

export function scheduleDto(schedule: ScheduleRecord) {
  return {
    id: schedule.id,
    date: schedule.date,
    updatedAt: schedule.updatedAt.toISOString(),
    jobs: schedule.jobs.map((job) => ({
      id: job.id,
      projectId: job.projectId,
      jobNo: job.project.jobNo || job.jobNo,
      projectName: job.project.name,
      clientName: job.project.clientName,
      foremanIds: job.foremen.map((assignment) => assignment.employeeId),
      employeeIds: job.labours.map((assignment) => assignment.employeeId),
      equipmentIds: job.equipments.map((assignment) => assignment.equipmentId),
      shift: job.shift,
      scope: job.scope,
      campStart: job.campStart,
      timeIn: job.timeIn,
      timeOut: job.timeOut,
    })),
  };
}

export const scheduleSummaryInclude = {
  jobs: { select: { projectId: true, shift: true } },
} satisfies Prisma.ScheduleInclude;

export type ScheduleSummaryRecord = Prisma.ScheduleGetPayload<{ include: typeof scheduleSummaryInclude }>;

export function scheduleSummaryDto(schedule: ScheduleSummaryRecord) {
  return {
    id: schedule.id,
    date: schedule.date,
    jobs: new Set(schedule.jobs.map((job) => job.projectId)).size,
    teamDispatches: schedule.jobs.length,
    day: schedule.jobs.filter((job) => job.shift === "Day").length,
    night: schedule.jobs.filter((job) => job.shift === "Night").length,
    updatedAt: schedule.updatedAt.toISOString(),
  };
}
