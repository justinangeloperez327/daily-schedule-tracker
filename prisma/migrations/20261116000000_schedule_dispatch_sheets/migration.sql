-- Group the existing per-job schedules into date-level schedule registers.
-- Existing schedule and assignment IDs remain intact.
CREATE TABLE "ScheduleSheet" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ScheduleSheet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleSheet_date_idx" ON "ScheduleSheet"("date");

ALTER TABLE "Schedule"
    ADD COLUMN "sheetId" TEXT,
    ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "shift" TEXT NOT NULL DEFAULT 'Day',
    ADD COLUMN "campStart" TEXT NOT NULL DEFAULT '';

INSERT INTO "ScheduleSheet" ("id", "date", "createdAt", "updatedAt")
SELECT 'legacy-' || md5("date"), "date", MIN("createdAt"), CURRENT_TIMESTAMP
FROM "Schedule"
GROUP BY "date";

UPDATE "Schedule"
SET "sheetId" = 'legacy-' || md5("date")
WHERE "sheetId" IS NULL;

ALTER TABLE "Schedule" ALTER COLUMN "sheetId" SET NOT NULL;

CREATE INDEX "Schedule_sheetId_sortOrder_idx" ON "Schedule"("sheetId", "sortOrder");
ALTER TABLE "Schedule"
    ADD CONSTRAINT "Schedule_sheetId_fkey"
    FOREIGN KEY ("sheetId") REFERENCES "ScheduleSheet"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing labour/equipment assignments. Foremen are a new, separate role.
CREATE TABLE "ScheduleForeman" (
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    CONSTRAINT "ScheduleForeman_pkey" PRIMARY KEY ("scheduleId", "employeeId")
);

CREATE INDEX "ScheduleForeman_employeeId_idx" ON "ScheduleForeman"("employeeId");
ALTER TABLE "ScheduleForeman"
    ADD CONSTRAINT "ScheduleForeman_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleForeman"
    ADD CONSTRAINT "ScheduleForeman_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
