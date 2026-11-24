import type { Prisma } from "@/generated/prisma/client";
import type { SiteReport, SiteReportSummary } from "@/lib/site-report";

export const siteReportInclude = {
  labours: { orderBy: { sortOrder: "asc" } },
  equipments: { orderBy: { sortOrder: "asc" } },
  createdBy: { select: { name: true } },
} satisfies Prisma.SiteDailyReportInclude;

export const siteReportSummaryInclude = {
  project: { select: { jobNo: true, name: true, clientName: true } },
  labours: { select: { otHours: true } },
  _count: { select: { equipments: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.SiteDailyReportInclude;

type ReportRecord = Prisma.SiteDailyReportGetPayload<{ include: typeof siteReportInclude }>;
type SummaryRecord = Prisma.SiteDailyReportGetPayload<{ include: typeof siteReportSummaryInclude }>;

export function siteReportDto(report: ReportRecord): SiteReport {
  return {
    id: report.id,
    projectId: report.projectId,
    date: report.date,
    activityDescription: report.activityDescription,
    remarks: report.remarks,
    labours: report.labours.map((labour) => ({
      employeeId: labour.employeeId,
      timeIn: labour.timeIn,
      timeOut: labour.timeOut,
      otHours: Number(labour.otHours),
    })),
    equipmentIds: report.equipments.map((equipment) => equipment.equipmentId),
    createdBy: report.createdBy?.name ?? null,
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function siteReportSummaryDto(report: SummaryRecord): SiteReportSummary {
  return {
    id: report.id,
    date: report.date,
    projectId: report.projectId,
    jobNo: report.project.jobNo ?? "",
    projectName: report.project.name,
    clientName: report.project.clientName,
    labourCount: report.labours.length,
    equipmentCount: report._count.equipments,
    otHours: report.labours.reduce((sum, labour) => sum + Number(labour.otHours), 0),
    createdBy: report.createdBy?.name ?? null,
    updatedAt: report.updatedAt.toISOString(),
  };
}

type ReportInput = {
  labours: { employeeId: string; timeIn: string; timeOut: string; otHours: number }[];
  equipmentIds: string[];
};

export function labourRows(input: ReportInput) {
  return input.labours.map((labour, index) => ({
    employeeId: labour.employeeId,
    timeIn: labour.timeIn,
    timeOut: labour.timeOut,
    otHours: labour.otHours,
    sortOrder: index,
  }));
}

export function equipmentRows(input: ReportInput) {
  return input.equipmentIds.map((equipmentId, index) => ({ equipmentId, sortOrder: index }));
}

export const DUPLICATE_REPORT_MESSAGE =
  "A site daily report already exists for this job order on this date. Open and edit that report instead.";
