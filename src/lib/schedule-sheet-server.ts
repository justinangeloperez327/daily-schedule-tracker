// Backward-compatible helper exports for code that previously used schedule sheets.
// The Prisma parent model is now Schedule and each child model is ScheduleJob.
export {
  scheduleInclude as sheetInclude,
  scheduleDto as sheetDto,
  scheduleSummaryInclude as sheetSummary,
  scheduleSummaryDto as summaryDto,
} from "@/lib/schedule-server";
export type {
  ScheduleRecord as SheetRecord,
  ScheduleSummaryRecord as SheetSummaryRecord,
} from "@/lib/schedule-server";
