export type ScheduleEntry = {
  id: string;
  date: string;
  jobNo: string;
  projectName: string;
  clientName: string;
  labours: string;
  equipment: string;
  timeIn: string;
  timeOut: string;
  scope: string;
  isSample?: boolean;
};

export type ScheduleDraft = Omit<ScheduleEntry, "id" | "isSample">;

export const STORAGE_KEY = "daily-schedule-tracker:entries:v1";

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
  const suffix = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 || 12;
  return displayHour + ":" + String(minute).padStart(2, "0") + " " + suffix;
}

export function blankDraft(date: string): ScheduleDraft {
  return {
    date,
    jobNo: "",
    projectName: "",
    clientName: "",
    labours: "",
    equipment: "",
    timeIn: "07:00",
    timeOut: "17:00",
    scope: "",
  };
}

// Obvious demo records are shown only to first-time visitors.
export function demoEntries(date: string): ScheduleEntry[] {
  return [
    {
      id: "sample-1",
      date,
      jobNo: "SAMPLE-001",
      projectName: "Entrance Gate Installation",
      clientName: "Example Client A",
      labours: "4 installers, 2 helpers",
      equipment: "Boom lift, pickup",
      timeIn: "07:00",
      timeOut: "17:00",
      scope: "Install and align entrance gate framing.",
      isSample: true,
    },
    {
      id: "sample-2",
      date,
      jobNo: "SAMPLE-002",
      projectName: "Handrail Works",
      clientName: "Example Client B",
      labours: "3 fabricators, 2 helpers",
      equipment: "Welding machine",
      timeIn: "08:00",
      timeOut: "16:30",
      scope: "Site measurement and handrail installation.",
      isSample: true,
    },
  ];
}

export function isScheduleEntry(value: unknown): value is ScheduleEntry {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.date === "string" &&
    typeof item.jobNo === "string" &&
    typeof item.projectName === "string" &&
    typeof item.clientName === "string" &&
    typeof item.labours === "string" &&
    typeof item.equipment === "string" &&
    typeof item.timeIn === "string" &&
    typeof item.timeOut === "string" &&
    typeof item.scope === "string"
  );
}
