-- DropIndex
DROP INDEX "SiteDailyReport_projectId_date_key";

-- CreateIndex
CREATE INDEX "SiteDailyReport_projectId_date_idx" ON "SiteDailyReport"("projectId", "date");
