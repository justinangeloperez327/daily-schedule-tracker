// Shared (client + server) types for the Site Daily Report.
export type SiteReportLabour = {
  employeeId: string;
  timeIn: string;
  timeOut: string;
  otHours: number;
};

export type SiteReport = {
  id: string;
  projectId: string;
  date: string;
  activityDescription: string;
  remarks: string;
  labours: SiteReportLabour[];
  equipmentIds: string[];
  createdBy: string | null;
  updatedAt: string;
};

export type SiteReportSummary = {
  id: string;
  date: string;
  projectId: string;
  jobNo: string;
  projectName: string;
  clientName: string;
  labourCount: number;
  equipmentCount: number;
  otHours: number;
  createdBy: string | null;
  updatedAt: string;
};

// Default number of empty labour rows shown on a new report.
export const DEFAULT_LABOUR_ROWS = 5;
export const DEFAULT_EQUIPMENT_ROWS = 3;

// OT can be entered in half-hour steps from 0 to 12 hours.
export const OT_HOUR_OPTIONS = Array.from({ length: 25 }, (_, index) => index / 2);

// Worked hours between two HH:mm times, allowing overnight shifts.
export function hoursBetween(timeIn: string, timeOut: string): number {
  if (!timeIn || !timeOut) return 0;
  const [inH, inM] = timeIn.split(":").map(Number);
  const [outH, outM] = timeOut.split(":").map(Number);
  let minutes = outH * 60 + outM - (inH * 60 + inM);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
}
