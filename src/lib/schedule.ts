export type ScheduleEntry = {
  id: string;
  date: string;
  jobNo: string;
  projectId: string;
  projectName: string;
  clientName: string;
  employeeIds: string[];
  equipmentIds: string[];
  labours: string;
  equipment: string;
  timeIn: string;
  timeOut: string;
  scope: string;
};

export type ScheduleDraft = Pick<
  ScheduleEntry,
  "date" | "jobNo" | "projectId" | "employeeIds" | "equipmentIds" | "timeIn" | "timeOut" | "scope"
>;

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + days);
  return dateKey(next);
}

export function dateLabel(date: string): string {
  if (!date) return "Select a date";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function timeLabel(time: string): string {
  if (!time) return "—";
  const [hour, minute] = time.split(":").map(Number);
  return (hour % 12 || 12) + ":" + String(minute).padStart(2, "0") + " " + (hour < 12 ? "AM" : "PM");
}

export function blankDraft(date: string): ScheduleDraft {
  return {
    date,
    jobNo: "",
    projectId: "",
    employeeIds: [],
    equipmentIds: [],
    timeIn: "07:00",
    timeOut: "17:00",
    scope: "",
  };
}
