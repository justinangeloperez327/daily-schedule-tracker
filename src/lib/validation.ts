import { z } from "zod";
import { employeeStatuses } from "@/lib/employee-status";

const employeeStatus = z.enum(employeeStatuses);

const requiredText = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(200).default("");
const notesText = z.string().trim().max(5000).default("");
const optionalIdentifier = z.string().trim().max(200).nullable().default(null).transform((value) => value || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm time.");
const optionalDate = z.union([z.literal(""), date]).default("");

export const scheduleDate = date;

export const projectInput = z.object({
  soNo: optionalText,
  jobNo: optionalIdentifier,
  rev: optionalText,
  clientName: requiredText,
  mainCategory: optionalText,
  subCategory: optionalText,
  name: requiredText,
  descriptions: notesText,
  contractValue: optionalText,
  paymentTerms: notesText,
  status: optionalText,
  projectInCharge: optionalText,
}).strict();

export const employeeInput = z.object({
  employeeCode: optionalIdentifier,
  name: requiredText,
  designation: optionalText,
  location: optionalText,
  category: optionalText,
  joiningDate: optionalDate,
  status: employeeStatus.default("Active"),
  remarks: notesText,
}).strict();

export const equipmentInput = z.object({
  registrationNo: optionalIdentifier,
  vehicleType: optionalText,
  vehicleDetails: requiredText,
  limit: optionalText,
  modelYear: optionalText,
  remarks: notesText,
}).strict();

// Excel imports are intentionally lenient: an incomplete spreadsheet row is
// kept as a record so it can be reviewed, edited or deleted later.
// Manual add/edit operations still require names and core descriptions.
export const projectImportInput = projectInput.extend({
  clientName: optionalText,
  name: optionalText,
});

export const employeeImportInput = employeeInput.extend({
  name: optionalText,
  // Older Excel files have no Status header; never infer employment status
  // unless an unambiguous status is explicitly supplied.
  status: z.preprocess((value) => !value ? "Not set" : value, employeeStatus),
});

export const equipmentImportInput = equipmentInput.extend({
  vehicleDetails: optionalText,
});

export const scheduleInput = z.object({
  date,
  jobNo: requiredText,
  projectId: z.string().min(1).max(200),
  timeIn: time,
  timeOut: time,
  scope: z.string().trim().min(1).max(5000),
  employeeIds: z.array(z.string().min(1).max(200)).max(100).default([]),
  equipmentIds: z.array(z.string().min(1).max(200)).max(100).default([]),
}).strict().refine((data) => new Set(data.employeeIds).size === data.employeeIds.length, {
  message: "Duplicate employees are not allowed.",
  path: ["employeeIds"],
}).refine((data) => new Set(data.equipmentIds).size === data.equipmentIds.length, {
  message: "Duplicate equipment is not allowed.",
  path: ["equipmentIds"],
});

// Each job has at least one foreman, labourer and equipment assignment.
// Prisma junction tables guarantee referential integrity and prevent repeated
// assignments within one role. Minimum counts are enforced at this API boundary.
export const scheduleJobInput = z.object({
  id: z.string().min(1).max(200).optional(),
  projectId: z.string().min(1).max(200),
  foremanIds: z.array(z.string().min(1).max(200)).min(1, "Select at least one foreman for each job.").max(60),
  employeeIds: z.array(z.string().min(1).max(200)).min(1, "Select at least one labourer for each job.").max(150),
  equipmentIds: z.array(z.string().min(1).max(200)).min(1, "Select at least one equipment item for each job.").max(100),
  shift: z.enum(["Day", "Night"]),
  scope: z.string().trim().max(200).default(""),
  dailyTarget: z.string().trim().max(5000).default(""),
  campStart: time,
  timeIn: time,
  timeOut: time,
}).strict().superRefine((job, ctx) => {
  for (const field of ["foremanIds", "employeeIds", "equipmentIds"] as const) {
    if (new Set(job[field]).size !== job[field].length) {
      ctx.addIssue({ code: "custom", path: [field], message: "Do not assign the same resource twice within a job role." });
    }
  }
});

export const dailyScheduleInput = z.object({
  date,
  jobs: z.array(scheduleJobInput).min(1, "Add at least one job.").max(100),
}).strict().superRefine((schedule, ctx) => {
  const ids = schedule.jobs.flatMap((job) => job.id ? [job.id] : []);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: "custom", path: ["jobs"], message: "Duplicate job row identifiers." });
  }
});
