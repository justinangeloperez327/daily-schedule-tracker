-- Preserve existing free-text Remarks. An explicit Status is now stored
-- separately and never overwrites Remarks.
ALTER TABLE "Employee" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'Not set';

-- Some legacy Excel rows stored their status in Remarks. Migrate only
-- unambiguous complete-field status values, leaving all other rows "Not set".
UPDATE "Employee"
SET "status" = CASE
  WHEN lower(btrim("remarks")) = 'active' THEN 'Active'
  WHEN lower(btrim("remarks")) = 'inactive' THEN 'Inactive'
  WHEN lower(btrim("remarks")) IN ('on leave', 'onleave', 'on-leave') THEN 'On leave'
  WHEN lower(btrim("remarks")) = 'terminated' THEN 'Terminated'
  ELSE 'Not set'
END;

CREATE INDEX "Employee_status_idx" ON "Employee"("status");
