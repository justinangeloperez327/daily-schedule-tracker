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
      'INSERT INTO "Equipment" ("id", "vehicleType", "vehicleDetails", "updatedAt") VALUES ($1, $2, $3, NOW())',
      [id, "Vehicle", "Test equipment " + index]
    );
  }
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

  const { rows } = await db.query(
    `SELECT j."id",
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

  console.log("Schedule relationship smoke test passed: 2 jobs, each with 2 foremen, 2 labourers, and 2 equipment items.");
} finally {
  await db.query("ROLLBACK").catch(() => undefined);
  await db.end();
}
