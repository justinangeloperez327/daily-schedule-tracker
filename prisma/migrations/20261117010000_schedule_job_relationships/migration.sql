-- Rename rather than drop/recreate the existing tables to preserve every
-- schedule, job, employee assignment, equipment assignment and primary key.
-- Renaming also keeps existing foreign-key references intact in PostgreSQL.
ALTER TABLE "Schedule" RENAME TO "ScheduleJob";
ALTER TABLE "ScheduleSheet" RENAME TO "Schedule";
ALTER TABLE "ScheduleForeman" RENAME TO "JobForeman";
ALTER TABLE "ScheduleEmployee" RENAME TO "JobLabour";
ALTER TABLE "ScheduleEquipment" RENAME TO "JobEquipment";

-- The parent record is now called Schedule; the child is ScheduleJob.
ALTER TABLE "ScheduleJob" RENAME COLUMN "sheetId" TO "scheduleId";
ALTER TABLE "JobForeman" RENAME COLUMN "scheduleId" TO "jobId";
ALTER TABLE "JobLabour" RENAME COLUMN "scheduleId" TO "jobId";
ALTER TABLE "JobEquipment" RENAME COLUMN "scheduleId" TO "jobId";

-- Match Prisma's standard constraint names so future schema diffs are stable.
ALTER TABLE "ScheduleJob" RENAME CONSTRAINT "Schedule_pkey" TO "ScheduleJob_pkey";
ALTER TABLE "Schedule" RENAME CONSTRAINT "ScheduleSheet_pkey" TO "Schedule_pkey";
ALTER TABLE "JobForeman" RENAME CONSTRAINT "ScheduleForeman_pkey" TO "JobForeman_pkey";
ALTER TABLE "JobLabour" RENAME CONSTRAINT "ScheduleEmployee_pkey" TO "JobLabour_pkey";
ALTER TABLE "JobEquipment" RENAME CONSTRAINT "ScheduleEquipment_pkey" TO "JobEquipment_pkey";

ALTER TABLE "ScheduleJob" RENAME CONSTRAINT "Schedule_sheetId_fkey" TO "ScheduleJob_scheduleId_fkey";
ALTER TABLE "ScheduleJob" RENAME CONSTRAINT "Schedule_projectId_fkey" TO "ScheduleJob_projectId_fkey";
ALTER TABLE "JobForeman" RENAME CONSTRAINT "ScheduleForeman_scheduleId_fkey" TO "JobForeman_jobId_fkey";
ALTER TABLE "JobForeman" RENAME CONSTRAINT "ScheduleForeman_employeeId_fkey" TO "JobForeman_employeeId_fkey";
ALTER TABLE "JobLabour" RENAME CONSTRAINT "ScheduleEmployee_scheduleId_fkey" TO "JobLabour_jobId_fkey";
ALTER TABLE "JobLabour" RENAME CONSTRAINT "ScheduleEmployee_employeeId_fkey" TO "JobLabour_employeeId_fkey";
ALTER TABLE "JobEquipment" RENAME CONSTRAINT "ScheduleEquipment_scheduleId_fkey" TO "JobEquipment_jobId_fkey";
ALTER TABLE "JobEquipment" RENAME CONSTRAINT "ScheduleEquipment_equipmentId_fkey" TO "JobEquipment_equipmentId_fkey";

ALTER INDEX "ScheduleSheet_date_idx" RENAME TO "Schedule_date_idx";
ALTER INDEX "Schedule_date_timeIn_idx" RENAME TO "ScheduleJob_date_timeIn_idx";
ALTER INDEX "Schedule_sheetId_sortOrder_idx" RENAME TO "ScheduleJob_scheduleId_sortOrder_idx";
ALTER INDEX "Schedule_projectId_idx" RENAME TO "ScheduleJob_projectId_idx";
ALTER INDEX "ScheduleForeman_employeeId_idx" RENAME TO "JobForeman_employeeId_idx";
ALTER INDEX "ScheduleEmployee_employeeId_idx" RENAME TO "JobLabour_employeeId_idx";
ALTER INDEX "ScheduleEquipment_equipmentId_idx" RENAME TO "JobEquipment_equipmentId_idx";

-- Existing records with zero foremen / labourers / equipment remain intact.
-- The 1+ rule is enforced for new/edited jobs by server-side validation,
-- not by fabricating historical assignment rows.
