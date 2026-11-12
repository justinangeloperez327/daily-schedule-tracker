# Daily Schedule Tracker

A lightweight daily work schedule tracker built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.

The first version provides a date-based schedule table for job number, project name, client name, labour, equipment, time in/out, and scope of work. No sidebar and no backend in this phase.

## Start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Notes

- Uses local browser storage for add, edit, and delete.
- Includes clearly labeled sample entries on first launch.
- Data is local to the browser and is not shared between users or devices.
- Requires Node.js 24.

## Export to Excel

Select a date and click **Export to Excel** at the top of the schedule. The app downloads a formatted `.xlsx` workbook containing all jobs for that date, using the seven schedule columns. Search filters do not limit exports. The button is disabled when there are no jobs scheduled for the selected date.

The generated workbook includes a schedule title, date, job count, readable column widths, alternating row shading, a frozen header, and Excel column filters. The export is generated in your browser from local schedule data and does not require a server.
