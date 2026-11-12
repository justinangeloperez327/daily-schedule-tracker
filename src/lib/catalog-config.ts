import type { CatalogKind } from "@/lib/catalog";

export type CatalogField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "date" | "text";
};

export const catalogConfigs: Record<
  CatalogKind,
  { title: string; singular: string; subtitle: string; fields: CatalogField[]; identity: string }
> = {
  projects: {
    title: "Projects",
    singular: "Project",
    subtitle: "Project register with contract details and assigned persons in charge.",
    identity: "jobNo",
    fields: [
      { key: "soNo", label: "So No" },
      { key: "jobNo", label: "Job No", placeholder: "e.g. G-SO-26-001" },
      { key: "rev", label: "Rev" },
      { key: "clientName", label: "Client Name", required: true },
      { key: "mainCategory", label: "Main Category" },
      { key: "subCategory", label: "Sub Category" },
      { key: "name", label: "Project Name", required: true },
      { key: "descriptions", label: "Descriptions" },
      { key: "contractValue", label: "Contract Value" },
      { key: "paymentTerms", label: "Payment Terms" },
      { key: "status", label: "Status" },
      { key: "projectInCharge", label: "Project In Charge" },
    ],
  },
  employees: {
    title: "Employees",
    singular: "Employee",
    subtitle: "Employee register with designation, location and joining details.",
    identity: "employeeCode",
    fields: [
      { key: "employeeCode", label: "Employee ID" },
      { key: "name", label: "Name", required: true },
      { key: "designation", label: "Designation" },
      { key: "location", label: "Location" },
      { key: "category", label: "Category" },
      { key: "joiningDate", label: "Joining Date", type: "date" },
      { key: "remarks", label: "Remarks" },
    ],
  },
  equipments: {
    title: "Equipments",
    singular: "Equipment",
    subtitle: "Equipment and vehicle register with registration and model details.",
    identity: "registrationNo",
    fields: [
      { key: "registrationNo", label: "Registration No" },
      { key: "vehicleType", label: "Vehicle Type" },
      { key: "vehicleDetails", label: "Vehicle Details", required: true },
      { key: "limit", label: "Limit" },
      { key: "modelYear", label: "Model Year" },
      { key: "remarks", label: "Remarks" },
    ],
  },
};

export function emptyCatalogDraft(kind: CatalogKind): Record<string, string> {
  return Object.fromEntries(catalogConfigs[kind].fields.map((field) => [field.key, ""]));
}
