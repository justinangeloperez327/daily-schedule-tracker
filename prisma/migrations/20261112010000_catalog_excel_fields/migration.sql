-- Retain existing records and their schedule assignments.
ALTER TABLE "Employee" RENAME COLUMN "trade" TO "designation";
ALTER TABLE "Equipment" RENAME COLUMN "name" TO "vehicleDetails";
ALTER TABLE "Equipment" RENAME COLUMN "category" TO "vehicleType";

ALTER TABLE "Project"
  ADD COLUMN "soNo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "jobNo" TEXT,
  ADD COLUMN "rev" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "mainCategory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "subCategory" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "descriptions" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "contractValue" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "paymentTerms" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "status" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "projectInCharge" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Employee"
  ADD COLUMN "employeeCode" TEXT,
  ADD COLUMN "location" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "category" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "joiningDate" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "remarks" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Equipment"
  ADD COLUMN "registrationNo" TEXT,
  ADD COLUMN "limit" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "modelYear" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "remarks" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "Equipment_name_idx";
CREATE INDEX "Equipment_vehicleDetails_idx" ON "Equipment"("vehicleDetails");
CREATE UNIQUE INDEX "Project_jobNo_rev_key" ON "Project"("jobNo","rev");
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
CREATE UNIQUE INDEX "Equipment_registrationNo_key" ON "Equipment"("registrationNo");
