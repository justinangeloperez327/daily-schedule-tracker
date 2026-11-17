// This is a separate status field: remarks remain free-text notes.
export const employeeStatuses = ["Active", "Inactive", "On leave", "Terminated", "Not set"] as const;
export type EmployeeStatus = (typeof employeeStatuses)[number];

export function normalizeEmployeeStatus(value: string): EmployeeStatus | null {
  const normalized = value.trim().toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ");
  if (normalized === "active") return "Active";
  if (normalized === "inactive") return "Inactive";
  if (normalized === "on leave" || normalized === "onleave") return "On leave";
  if (normalized === "terminated") return "Terminated";
  if (normalized === "not set" || normalized === "unknown" || normalized === "unspecified") return "Not set";
  return null;
}
