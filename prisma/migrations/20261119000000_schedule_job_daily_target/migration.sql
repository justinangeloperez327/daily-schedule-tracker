-- Daily work targets belong to each scheduled job, independently of Scope of Work.
-- The default preserves existing records when the migration is deployed.
ALTER TABLE "ScheduleJob" ADD COLUMN "dailyTarget" TEXT NOT NULL DEFAULT '';
