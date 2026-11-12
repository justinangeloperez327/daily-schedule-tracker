import { z } from "zod";

const shortText = z.string().trim().min(1).max(200);
const optionalResource = z.string().trim().max(200);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === value;
}, "Enter a valid calendar date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm time.");

export const scheduleDate = date;

export const projectInput = z.object({
  name: shortText,
  clientName: shortText,
}).strict();

export const employeeInput = z.object({
  name: shortText,
  trade: optionalResource,
}).strict();

export const equipmentInput = z.object({
  name: shortText,
  category: optionalResource,
}).strict();

export const scheduleInput = z.object({
  date,
  jobNo: shortText,
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
