-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "jobNo" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "timeIn" TEXT NOT NULL,
    "timeOut" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEmployee" (
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    CONSTRAINT "ScheduleEmployee_pkey" PRIMARY KEY ("scheduleId","employeeId")
);

-- CreateTable
CREATE TABLE "ScheduleEquipment" (
    "scheduleId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    CONSTRAINT "ScheduleEquipment_pkey" PRIMARY KEY ("scheduleId","equipmentId")
);

CREATE INDEX "Project_name_idx" ON "Project"("name");
CREATE INDEX "Employee_name_idx" ON "Employee"("name");
CREATE INDEX "Equipment_name_idx" ON "Equipment"("name");
CREATE INDEX "Schedule_date_timeIn_idx" ON "Schedule"("date","timeIn");
CREATE INDEX "Schedule_projectId_idx" ON "Schedule"("projectId");
CREATE INDEX "ScheduleEmployee_employeeId_idx" ON "ScheduleEmployee"("employeeId");
CREATE INDEX "ScheduleEquipment_equipmentId_idx" ON "ScheduleEquipment"("equipmentId");

ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleEmployee" ADD CONSTRAINT "ScheduleEmployee_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleEmployee" ADD CONSTRAINT "ScheduleEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleEquipment" ADD CONSTRAINT "ScheduleEquipment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleEquipment" ADD CONSTRAINT "ScheduleEquipment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
