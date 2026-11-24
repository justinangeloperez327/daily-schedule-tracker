-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteDailyReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "activityDescription" TEXT NOT NULL DEFAULT '',
    "remarks" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteDailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteReportLabour" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "timeIn" TEXT NOT NULL,
    "timeOut" TEXT NOT NULL,
    "otHours" DECIMAL(4,1) NOT NULL DEFAULT 0,

    CONSTRAINT "SiteReportLabour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteReportEquipment" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteReportEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "SiteDailyReport_date_idx" ON "SiteDailyReport"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDailyReport_projectId_date_key" ON "SiteDailyReport"("projectId", "date");

-- CreateIndex
CREATE INDEX "SiteReportLabour_employeeId_idx" ON "SiteReportLabour"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteReportLabour_reportId_employeeId_key" ON "SiteReportLabour"("reportId", "employeeId");

-- CreateIndex
CREATE INDEX "SiteReportEquipment_equipmentId_idx" ON "SiteReportEquipment"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteReportEquipment_reportId_equipmentId_key" ON "SiteReportEquipment"("reportId", "equipmentId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDailyReport" ADD CONSTRAINT "SiteDailyReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteDailyReport" ADD CONSTRAINT "SiteDailyReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteReportLabour" ADD CONSTRAINT "SiteReportLabour_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SiteDailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteReportLabour" ADD CONSTRAINT "SiteReportLabour_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteReportEquipment" ADD CONSTRAINT "SiteReportEquipment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SiteDailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteReportEquipment" ADD CONSTRAINT "SiteReportEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
