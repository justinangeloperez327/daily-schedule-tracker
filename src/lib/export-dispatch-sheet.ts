import ExcelJS from "exceljs";
import type { Project, Employee, Equipment } from "@/lib/catalog";
import type { DispatchEntry } from "@/lib/dispatch";
import { dateLabel } from "@/lib/schedule";

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function exportDispatchSheet(
  date: string,
  rows: DispatchEntry[],
  projects: Project[],
  employees: Employee[],
  equipments: Equipment[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Daily Schedule Tracker";
  const sheet = workbook.addWorksheet("Dispatch Schedule");

  sheet.columns = [
    { header: "Job No", key: "jobNo", width: 22 },
    { header: "Project Name", key: "project", width: 32 },
    { header: "Client", key: "client", width: 26 },
    { header: "Foremen", key: "foremen", width: 30 },
    { header: "Labours", key: "labours", width: 40 },
    { header: "Equipment", key: "equipment", width: 28 },
    { header: "Shift", key: "shift", width: 13 },
    { header: "Main Category", key: "mainCategory", width: 25 },
    { header: "Subcategory", key: "subCategory", width: 25 },
    { header: "Daily Target", key: "dailyTarget", width: 48 },
    { header: "Camp Start", key: "camp", width: 16 },
    { header: "Start Time", key: "start", width: 16 },
    { header: "End Time", key: "end", width: 16 },
  ];

  sheet.insertRow(1, ["DAILY TEAM DISPATCH SCHEDULE — " + dateLabel(date)]);
  sheet.mergeCells("A1:M1");
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF20262E" } };
  sheet.getCell("A1").alignment = { vertical: "middle" };
  sheet.getRow(1).height = 36;

  const header = sheet.getRow(2);
  header.height = 29;
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF20262E" } };
    cell.font = { name: "Aptos", bold: true, color: { argb: "FFFFFFFF" } };
  });

  const names = (ids: string[]) =>
    ids.map((id) => employees.find((person) => person.id === id)?.name || "Unnamed employee").join(", ");

  rows.forEach((entry, index) => {
    const project = projects.find((item) => item.id === entry.projectId);
    const row = sheet.addRow({
      jobNo: project?.jobNo || "",
      project: project?.name || "",
      client: project?.clientName || "",
      foremen: names(entry.foremanIds),
      labours: names(entry.employeeIds),
      equipment: entry.equipmentIds.map((id) => ((equipment) => equipment ? ([equipment.fleet, equipment.description || equipment.vehicleDetails].filter(Boolean).join(" — ") || "Unnamed equipment") : "Unnamed equipment")(equipments.find((e) => e.id === id))).join(", "),
      shift: entry.shift,
      mainCategory: project?.mainCategory || "",
      subCategory: project?.subCategory || "",
      dailyTarget: entry.dailyTarget,
      camp: entry.campStart,
      start: entry.timeIn,
      end: entry.timeOut,
    });
    // Taller rows keep multi-line daily targets readable in the exported plan.
    const targetLines = (entry.dailyTarget || "").split("\n")
      .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 44)), 0);
    row.height = Math.min(120, Math.max(44, targetLines * 15 + 10));
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Aptos", color: { argb: "FF303740" } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "FFF7F8FA" : "FFFFFFFF" } };
    });
  });

  sheet.views = [{ state: "frozen", ySplit: 2 }];
  sheet.autoFilter = { from: "A2", to: "M" + Math.max(2, sheet.rowCount) };
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: MIME });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dispatch-schedule-" + date + ".xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
