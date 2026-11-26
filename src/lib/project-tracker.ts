export const trackerTypes = ["substation", "bus_shelter", "guardrail"] as const;
export type TrackerType = (typeof trackerTypes)[number];

export const trackerTypeLabels: Record<TrackerType, string> = {
  substation: "Substation",
  bus_shelter: "Bus Shelters",
  guardrail: "Guardrail",
};

export const wirStatuses = ["Not submitted", "Submitted", "Approved", "Rejected", "Revise and resubmit", "Not applicable"] as const;
export type WirStatus = (typeof wirStatuses)[number];

export const milestones = [
  { key: "siteMeasurementDate", label: "Site measurement" },
  { key: "drawingToProductionDate", label: "Drawing to production" },
  { key: "deliveryDate", label: "Delivery" },
  { key: "installationDate", label: "Installation" },
  { key: "wirDate", label: "WIR date" },
] as const;

export type TrackerItem = {
  id: string;
  projectId: string;
  trackerType: TrackerType;
  code: string;
  label: string;
  sortOrder: number;
  locationReference: string;
  plannedLengthLm: string | null;
  siteMeasurementDate: string;
  drawingToProductionDate: string;
  deliveryDate: string;
  installationDate: string;
  wirDate: string;
  wirStatus: WirStatus;
  wirReference: string;
  remarks: string;
};

export function trackerTypeForProject(project: { subCategory: string; mainCategory: string }): TrackerType | null {
  // Subcategory is the primary classification. Main category is only a fallback
  // for older projects without a subcategory.
  const normalized = (project.subCategory.trim() || project.mainCategory.trim())
    .toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\bsub\s*station\b/.test(normalized) || normalized.includes("substation")) return "substation";
  if (/\bbus\s*shelter(?:s)?\b/.test(normalized)) return "bus_shelter";
  if (/\bguard\s*rail(?:s)?\b/.test(normalized)) return "guardrail";
  return null;
}

export function trackerInitialItems(type: TrackerType) {
  if (type !== "substation") return [];
  return [
    { code: "SUB-DOOR-1", label: "Door 1", sortOrder: 1 },
    { code: "SUB-DOOR-2", label: "Door 2", sortOrder: 2 },
    { code: "SUB-GRATING-SUPPORT", label: "Grating Support", sortOrder: 3 },
    { code: "SUB-GRATING-PANEL", label: "Grating Panel", sortOrder: 4 },
  ];
}

export function trackerItemCode(type: Exclude<TrackerType, "substation">, number: number) {
  return (type === "bus_shelter" ? "BS-" : "GR-") + String(number).padStart(3, "0");
}

export function trackerItemLabel(type: Exclude<TrackerType, "substation">, number: number) {
  return (type === "bus_shelter" ? "Bus Shelter " : "Guardrail Section ") + String(number).padStart(2, "0");
}

export function trackerProgress(item: TrackerItem): number {
  const dates = [item.siteMeasurementDate, item.drawingToProductionDate, item.deliveryDate, item.installationDate];
  return dates.filter(Boolean).length + (item.wirStatus === "Approved" ? 1 : 0);
}
