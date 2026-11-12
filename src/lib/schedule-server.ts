import type { Prisma } from "@/generated/prisma/client";

export const scheduleInclude = {
  project: true,
  employees: { include: { employee: true } },
  equipments: { include: { equipment: true } },
} satisfies Prisma.ScheduleInclude;

export type ScheduleRecord = Prisma.ScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

export function scheduleDto(row: ScheduleRecord) {
  return {
    id: row.id,
    date: row.date,
    jobNo: row.jobNo,
    projectId: row.projectId,
    projectName: row.project.name,
    clientName: row.project.clientName,
    timeIn: row.timeIn,
    timeOut: row.timeOut,
    scope: row.scope,
    employeeIds: row.employees.map((item) => item.employeeId),
    equipmentIds: row.equipments.map((item) => item.equipmentId),
    labours: row.employees.map((item) => item.employee.name).join(", "),
    equipment: row.equipments.map((item) => item.equipment.name).join(", "),
  };
}
