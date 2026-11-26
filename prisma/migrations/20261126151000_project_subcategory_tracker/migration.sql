-- Per-project asset milestone tracker, linked to the existing project register.
CREATE TABLE "ProjectTrackerItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "trackerType" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "locationReference" TEXT NOT NULL DEFAULT '',
  "plannedLengthLm" DECIMAL(12,2),
  "siteMeasurementDate" TEXT NOT NULL DEFAULT '',
  "drawingToProductionDate" TEXT NOT NULL DEFAULT '',
  "deliveryDate" TEXT NOT NULL DEFAULT '',
  "installationDate" TEXT NOT NULL DEFAULT '',
  "wirDate" TEXT NOT NULL DEFAULT '',
  "wirStatus" TEXT NOT NULL DEFAULT 'Not submitted',
  "wirReference" TEXT NOT NULL DEFAULT '',
  "remarks" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectTrackerItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectTrackerItem_projectId_code_key" ON "ProjectTrackerItem" ("projectId", "code");
CREATE INDEX "ProjectTrackerItem_projectId_sortOrder_idx" ON "ProjectTrackerItem" ("projectId", "sortOrder");
ALTER TABLE "ProjectTrackerItem" ADD CONSTRAINT "ProjectTrackerItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
