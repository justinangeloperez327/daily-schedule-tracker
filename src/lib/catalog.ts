export type Project = {
  id: string;
  name: string;
  clientName: string;
};

export type Employee = {
  id: string;
  name: string;
  trade: string;
};

export type Equipment = {
  id: string;
  name: string;
  category: string;
};

export type CatalogKind = "projects" | "employees" | "equipments";
