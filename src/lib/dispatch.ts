export type DispatchShift = "Day" | "Night";

export type DispatchEntry = {
  id?: string;
  projectId: string;
  foremanIds: string[];
  employeeIds: string[];
  shift: DispatchShift;
  scope: string;
  campStart: string;
  timeIn: string;
  timeOut: string;
};

export type DispatchSheet = {
  id: string;
  date: string;
  updatedAt: string;
  dispatches: Array<DispatchEntry & {
    jobNo: string;
    projectName: string;
    clientName: string;
    equipmentIds: string[];
  }>;
};

export const scopeOptions = [
  "Bus Shelter",
  "Substation",
  "Guardrail",
  "Wire Rope",
  "Gantry",
  "Camera Cladding",
  "To Be Followed",
] as const;

export function emptyDispatch(): DispatchEntry {
  return {
    projectId: "",
    foremanIds: [],
    employeeIds: [],
    shift: "Day",
    scope: "",
    campStart: "06:00",
    timeIn: "07:00",
    timeOut: "17:00",
  };
}
