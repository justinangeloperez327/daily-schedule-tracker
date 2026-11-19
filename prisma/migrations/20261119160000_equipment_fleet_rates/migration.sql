-- Add the new fleet register fields without losing existing equipment or assignments.
ALTER TABLE "Equipment"
  ADD COLUMN "fleet" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ratePerDay" DECIMAL(12,2),
  ADD COLUMN "ratePerHour" DECIMAL(12,2);

-- Legacy data is retained in place; use equivalent values to populate the new UI.
UPDATE "Equipment"
SET "fleet" = COALESCE("registrationNo", ''),
    "description" = COALESCE("vehicleDetails", '');

-- Older fields remain for historical records, but new equipment uses four fields.
ALTER TABLE "Equipment"
  ALTER COLUMN "vehicleType" SET DEFAULT '',
  ALTER COLUMN "vehicleDetails" SET DEFAULT '';

CREATE INDEX "Equipment_fleet_idx" ON "Equipment"("fleet");
