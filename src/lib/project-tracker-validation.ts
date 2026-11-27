import { z } from "zod";
import { wirStatuses } from "@/lib/project-tracker";

export const trackerDate = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
  }, "Enter a valid date."),
]);

export const trackerInitInput = z.object({
  projectId: z.string().min(1).max(200),
  count: z.number().int().min(1).max(100).default(1),
}).strict();

export const trackerItemUpdateInput = z.object({
  label: z.string().trim().min(1).max(150),
  locationReference: z.string().trim().max(200),
  plannedLengthLm: z.union([
    z.literal(""),
    z.string().regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/, "Use a non-negative length (lm) with at most 2 decimals."),
  ]).transform((value) => value || null),
  siteMeasurementDate: trackerDate,
  drawingToProductionDate: trackerDate,
  deliveryDate: trackerDate,
  installationDate: trackerDate,
  wirDate: trackerDate,
  wirStatus: z.enum(wirStatuses),
  wirReference: z.string().trim().max(120),
  remarks: z.string().trim().max(5000),
}).strict();
