-- Identifier columns are catalog attributes, not unique keys.
-- Keep primary keys and schedule foreign keys unchanged so existing assignments are preserved.
DROP INDEX IF EXISTS "Project_jobNo_rev_key";
DROP INDEX IF EXISTS "Employee_employeeCode_key";
DROP INDEX IF EXISTS "Equipment_registrationNo_key";
CREATE INDEX "Project_jobNo_rev_idx" ON "Project"("jobNo", "rev");
CREATE INDEX "Employee_employeeCode_idx" ON "Employee"("employeeCode");
CREATE INDEX "Equipment_registrationNo_idx" ON "Equipment"("registrationNo");
