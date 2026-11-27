// CI-only relational smoke test. Every insert is rolled back.
// Never run this script against production.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

if (process.env.GITHUB_ACTIONS !== "true" || process.env.CI !== "true") {
  throw new Error("The schedule relationship test must only run in isolated GitHub CI.");
}
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes("localhost")) {
  throw new Error("Refusing to test a database other than the temporary localhost CI database.");
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN");
  const projectId = randomUUID();
  const scheduleId = randomUUID();
  const jobIds = [randomUUID(), randomUUID()];
  const foremen = [randomUUID(), randomUUID()];
  const labours = [randomUUID(), randomUUID()];
  const equipment = [randomUUID(), randomUUID()];

  await db.query(
    'INSERT INTO "Project" ("id", "name", "clientName", "updatedAt") VALUES ($1, $2, $3, NOW())',
    [projectId, "Schedule relationship test", "Test client"]
  );

  for (const [index, id] of [...foremen, ...labours].entries()) {
    await db.query(
      'INSERT INTO "Employee" ("id", "name", "designation", "updatedAt") VALUES ($1, $2, $3, NOW())',
      [id, "Test employee " + index, index < foremen.length ? "Foreman" : "Labour"]
    );
  }
  for (const [index, id] of equipment.entries()) {
    await db.query(
      'INSERT INTO "Equipment" ("id", "vehicleType", "vehicleDetails", "fleet", "description", "ratePerDay", "ratePerHour", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
      [id, "Vehicle", "Test equipment " + index, "FLEET-" + index,
        "Equipment description " + index, "250.50", "35.25"]
    );
  }
  const fleetRate = await db.query('SELECT "fleet", "description", "ratePerDay"::text AS "ratePerDay", "ratePerHour"::text AS "ratePerHour" FROM "Equipment" WHERE "id" = $1', [equipment[0]]);
  assert.equal(fleetRate.rows[0].fleet, "FLEET-0");
  assert.equal(fleetRate.rows[0].description, "Equipment description 0");
  assert.equal(fleetRate.rows[0].ratePerDay, "250.50");
  assert.equal(fleetRate.rows[0].ratePerHour, "35.25");
  await db.query(
    'INSERT INTO "Schedule" ("id", "date", "updatedAt") VALUES ($1, $2, NOW())',
    [scheduleId, "2026-11-17"]
  );

  for (const [index, id] of jobIds.entries()) {
    await db.query(
      `INSERT INTO "ScheduleJob"
       ("id", "scheduleId", "projectId", "date", "jobNo", "timeIn", "timeOut", "scope", "sortOrder", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [id, scheduleId, projectId, "2026-11-17", "JOB-001", "07:00", "17:00", "Bus Shelter", index]
    );

    for (const employeeId of foremen) {
      await db.query('INSERT INTO "JobForeman" ("jobId", "employeeId") VALUES ($1, $2)', [id, employeeId]);
    }
    for (const employeeId of labours) {
      await db.query('INSERT INTO "JobLabour" ("jobId", "employeeId") VALUES ($1, $2)', [id, employeeId]);
    }
    for (const equipmentId of equipment) {
      await db.query('INSERT INTO "JobEquipment" ("jobId", "equipmentId") VALUES ($1, $2)', [id, equipmentId]);
    }
  }

  // Exercise the new Daily Target field and preserve the default for older rows.
  await db.query('UPDATE "ScheduleJob" SET "dailyTarget" = $2 WHERE "id" = $1', [
    jobIds[0],
    "Install delivered corner panels and top rail",
  ]);
  // Check tracker milestones, per-project uniqueness, nullable guardrail length,
  // and the project's cascade relationship without touching production data.
  const trackerId = randomUUID();
  await db.query(
    'INSERT INTO "ProjectTrackerItem" ("id", "projectId", "trackerType", "code", "label", "siteMeasurementDate", "wirStatus", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
    [trackerId, projectId, "substation", "SUB-DOOR-1", "Door 1", "2026-11-10", "Submitted"]
  );
  const trackerRows = await db.query(
    'SELECT "label", "siteMeasurementDate", "wirStatus" FROM "ProjectTrackerItem" WHERE "projectId" = $1', [projectId]
  );
  assert.equal(trackerRows.rows.length, 1);
  assert.equal(trackerRows.rows[0].label, "Door 1");
  assert.equal(trackerRows.rows[0].siteMeasurementDate, "2026-11-10");
  assert.equal(trackerRows.rows[0].wirStatus, "Submitted");
  const { rows } = await db.query(
    `SELECT j."id", j."dailyTarget",
        COUNT(DISTINCT f."employeeId")::int AS foremen,
        COUNT(DISTINCT l."employeeId")::int AS labours,
        COUNT(DISTINCT e."equipmentId")::int AS equipment
     FROM "ScheduleJob" j
     JOIN "JobForeman" f ON f."jobId" = j."id"
     JOIN "JobLabour" l ON l."jobId" = j."id"
     JOIN "JobEquipment" e ON e."jobId" = j."id"
     WHERE j."scheduleId" = $1
     GROUP BY j."id"`,
    [scheduleId]
  );
  assert.equal(rows.length, 2, "A schedule must own two independently assigned jobs");
  for (const job of rows) {
    assert.equal(job.foremen, 2);
    assert.equal(job.labours, 2);
    assert.equal(job.equipment, 2);
    assert.equal(job.dailyTarget,
      job.id === jobIds[0] ? "Install delivered corner panels and top rail" : "",
      "Each job must retain its own Daily Target, with an empty default for legacy jobs");
  }

  await db.query('DELETE FROM "Schedule" WHERE "id" = $1', [scheduleId]);
  for (const table of ["ScheduleJob", "JobForeman", "JobLabour", "JobEquipment"]) {
    const result = await db.query('SELECT COUNT(*)::int AS count FROM "' + table + '"');
    assert.equal(result.rows[0].count, 0, table + " must cascade with the schedule");
  }

  const retained = await db.query('SELECT COUNT(*)::int AS count FROM "Employee"');
  assert.equal(retained.rows[0].count, 4, "Deleting a schedule must not delete employee catalog records");
  const retainedEquipment = await db.query('SELECT COUNT(*)::int AS count FROM "Equipment"');
  assert.equal(retainedEquipment.rows[0].count, 2, "Deleting a schedule must not delete equipment catalog records");

  // A tracker belongs to its project, not a daily schedule. Removing the
  // project must cascade its tracker rows rather than leave orphaned assets.
  await db.query('DELETE FROM "Project" WHERE "id" = $1', [projectId]);
  const removedTrackers = await db.query(
    'SELECT COUNT(*)::int AS count FROM "ProjectTrackerItem" WHERE "projectId" = $1', [projectId]
  );
  assert.equal(removedTrackers.rows[0].count, 0, "Tracker items must cascade when the project is deleted");

  console.log("Schedule and project tracker relationship smoke tests passed.");
} finally {
  await db.query("ROLLBACK").catch(() => undefined);
  await db.end();
}
