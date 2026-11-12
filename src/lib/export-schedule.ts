import ExcelJS from "exceljs";

import { dateLabel, timeLabel, type ScheduleEntry } from "@/lib/schedule";

const EXCEL_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function exportScheduleToExcel(date: string, entries: ScheduleEntry[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Daily Schedule Tracker";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Daily Schedule", {
    views: [{ state: "frozen", ySplit: 5 }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  // Keep the same seven columns as the daily schedule table.
  worksheet.columns = [
    { key: "jobNo", width: 21 },
    { key: "projectName", width: 34 },
    { key: "clientName", width: 28 },
    { key: "labours", width: 30 },
    { key: "equipment", width: 28 },
    { key: "time", width: 24 },
    { key: "scope", width: 55 },
  ];

  worksheet.mergeCells("A1:G1");
  worksheet.getCell("A1").value = "DAILY WORK SCHEDULE";
  worksheet.getCell("A1").font = {
    name: "Aptos",
    size: 18,
    bold: true,
    color: { argb: "FF20262E" },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };
  worksheet.getRow(1).height = 36;
  worksheet.getRow(2).height = 12;

  worksheet.getCell("A3").value = "Schedule date:";
  worksheet.getCell("A3").font = { name: "Aptos", bold: true, color: { argb: "FF5C6672" } };
  worksheet.mergeCells("B3:E3");
  worksheet.getCell("B3").value = dateLabel(date);
  worksheet.getCell("B3").font = { name: "Aptos", color: { argb: "FF20262E" } };
  worksheet.getCell("F3").value = "Total jobs:";
  worksheet.getCell("F3").font = { name: "Aptos", bold: true, color: { argb: "FF5C6672" } };
  worksheet.getCell("G3").value = entries.length;
  worksheet.getCell("G3").font = { name: "Aptos", bold: true, color: { argb: "FF20262E" } };
  worksheet.getRow(3).height = 24;
  worksheet.getRow(4).height = 12;

  const headerRow = worksheet.getRow(5);
  headerRow.values = [
    "Job No",
    "Project Name",
    "Client Name",
    "Labours",
    "Equipment",
    "Time (In / Out)",
    "Scope",
  ];
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF20262E" } };
    cell.font = { name: "Aptos", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const sortedEntries = [...entries].sort(
    (a, b) => a.timeIn.localeCompare(b.timeIn) || a.jobNo.localeCompare(b.jobNo)
  );

  sortedEntries.forEach((entry, index) => {
    const row = worksheet.addRow([
      entry.jobNo,
      entry.projectName,
      entry.clientName,
      entry.labours,
      entry.equipment,
      timeLabel(entry.timeIn) + " – " + timeLabel(entry.timeOut),
      entry.scope,
    ]);

    row.height = 44;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: "Aptos", size: 10, color: { argb: "FF303740" } };
      cell.alignment = { vertical: "top", wrapText: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFF7F8FA" },
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E8EC" } },
      };
    });
  });

  worksheet.autoFilter = { from: "A5", to: "G" + worksheet.rowCount };
  worksheet.pageSetup.printTitlesRow = "1:5";
  worksheet.headerFooter.oddFooter = "Daily Schedule Tracker  •  Page &P of &N";

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: EXCEL_MIME });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "daily-schedule-" + date.replace(/[^0-9-]/g, "") + ".xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
