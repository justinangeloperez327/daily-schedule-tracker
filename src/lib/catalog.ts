export type CatalogKind = "projects" | "employees" | "equipments";

export type Project = {
  id: string;
  soNo: string;
  jobNo: string | null;
  rev: string;
  clientName: string;
  mainCategory: string;
  subCategory: string;
  name: string;
  descriptions: string;
  contractValue: string;
  paymentTerms: string;
  status: string;
  projectInCharge: string;
};

export type Employee = {
  id: string;
  employeeCode: string | null;
  name: string;
  designation: string;
  location: string;
  category: string;
  joiningDate: string;
  remarks: string;
};

export type Equipment = {
  id: string;
  registrationNo: string | null;
  vehicleType: string;
  vehicleDetails: string;
  limit: string;
  modelYear: string;
  remarks: string;
};
