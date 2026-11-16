import type { Prisma } from "@/generated/prisma/client";

export const sheetInclude = {
  dispatches: {
    include: {
      project: true,
      employees: { include: { employee: true } },
      foremen: { include: { employee: true } },
      equipments: { include: { equipment: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.ScheduleSheetInclude;

export type SheetRecord = Prisma.ScheduleSheetGetPayload<{ include: typeof sheetInclude }>;

export function sheetDto(sheet: SheetRecord) {
  return {
    id: sheet.id,
    date: sheet.date,
    updatedAt: sheet.updatedAt.toISOString(),
    dispatches: sheet.dispatches.map((dispatch) => ({
      id: dispatch.id,
      projectId: dispatch.projectId,
      jobNo: dispatch.project.jobNo || dispatch.jobNo,
      projectName: dispatch.project.name,
      clientName: dispatch.project.clientName,
      foremanIds: dispatch.foremen.map((f) => f.employeeId),
      employeeIds: dispatch.employees.map((e) => e.employeeId),
      equipmentIds: dispatch.equipments.map((e) => e.equipmentId),
      shift: dispatch.shift,
      scope: dispatch.scope,
      campStart: dispatch.campStart,
      timeIn: dispatch.timeIn,
      timeOut: dispatch.timeOut,
    })),
  };
}

export const sheetSummary = {
  dispatches: { select: { projectId: true, shift: true } },
} satisfies Prisma.ScheduleSheetInclude;

export type SheetSummaryRecord = Prisma.ScheduleSheetGetPayload<{ include: typeof sheetSummary }>;

export function summaryDto(sheet: SheetSummaryRecord) {
  return {
    id: sheet.id,
    date: sheet.date,
    jobs: new Set(sheet.dispatches.map((dispatch) => dispatch.projectId)).size,
    teamDispatches: sheet.dispatches.length,
    day: sheet.dispatches.filter((dispatch) => dispatch.shift === "Day").length,
    night: sheet.dispatches.filter((dispatch) => dispatch.shift === "Night").length,
    updatedAt: sheet.updatedAt.toISOString(),
  };
}
