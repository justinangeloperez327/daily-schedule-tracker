# Daily Schedule Tracker

A minimal daily site work planner built with **Next.js 16**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Prisma ORM 7**, and **PostgreSQL**.

## Pages

- **Schedules** — create, edit, delete, search and export jobs by date; assign a project, employees and equipment
- **Projects** — project name and client name
- **Employees** — employee name and trade/position
- **Equipments** — equipment name and category/type

The layout uses **top navigation only**, without a sidebar.

## Database and local development

Requires Node.js 24 and a running PostgreSQL database.

1. Create a PostgreSQL database named `daily_schedule_tracker` (or choose your own name).
2. Copy the environment template: `cp .env.example .env` (on Windows PowerShell: `Copy-Item .env.example .env`).
3. Set `DATABASE_URL` to your PostgreSQL connection URI in `.env`. For hosted PostgreSQL, optionally use `DIRECT_URL` for migrations when your runtime URL uses pooling.
4. Install and generate the Prisma Client:

   ```bash
   npm install
   npm run db:generate
   ```

5. Apply the committed database migration:

   ```bash
   npm run db:deploy
   ```

6. Start the site:

   ```bash
   npm run dev
   ```

Open **http://localhost:3000**. The homepage redirects to **/schedules**.

For development of future schema changes, run `npm run db:migrate -- --name <migration-name>`, review the generated SQL, and commit the migration. For production use `npm run db:deploy`, never `db push` against existing records.

## Prisma models

- **Project** — one project can have many schedules
- **Employee** — assigned to schedules through `ScheduleEmployee` (many-to-many)
- **Equipment** — assigned through `ScheduleEquipment` (many-to-many)
- **Schedule** — date, job number, project, assigned employees/equipment, time in/out, scope

Daily schedule dates and times are stored as site-local `YYYY-MM-DD` and `HH:mm` strings, so rendering a schedule does not shift dates across timezones.

Deleting a project, employee, or equipment that is assigned to a schedule is blocked to protect records. Remove the assignment first. Deleting a schedule removes its assignment rows.

## Export to Excel

Select a schedule date and click **Export to Excel**. The browser downloads a formatted `.xlsx` with the day's seven schedule columns, date, total jobs, readable widths, frozen header, and filters. Export includes all jobs for the date regardless of search filtering.

## Hosting

- Provision your own PostgreSQL database and set `DATABASE_URL` in the hosting environment (and `DIRECT_URL` if needed for migrations). No credentials should be committed to Git.
- Run migrations as a controlled release step: `npm run db:deploy`.
- **Automatic Vercel Git deployments are disabled** by `vercel.json`. Deploy intentionally using `vercel --prod`.
- GitHub Actions checks types, linting and build without connecting to a database.

## Current limitations

This is an **unauthenticated prototype**. Do **not** expose the app publicly or use live personnel/project data until access control and authentication are added. The API currently accepts writes from any caller who can reach it.

**Migration note:** The earlier prototype stored schedules only in the browser's `localStorage`. Those entries are **not automatically imported** into PostgreSQL. The new version leaves the old browser data untouched; existing entries must be transferred separately if needed.

No seeded demo records are created in the database. Set up projects, employees and equipments before scheduling.

## Import Excel into Projects, Employees, and Equipments

Each catalog page now has **Import Excel** and a **Download Excel template** option. Upload an `.xlsx`, inspect the first five rows in the preview, then select **Confirm import**. The table reloads and displays the number added and skipped.

**Project columns:** So No, Job No, Rev, Client Name, Main Category, Sub Category, Project Name, Descriptions, Contract Value, Payment Terms, Status, Project In Charge.

**Employee columns:** Employee ID, Name, Designation, Location, Category, Joining Date, Remarks.

**Equipment columns:** Registration No, Vehicle Type, Vehicle Details, Limit, Model Year, Remarks.

- Headers are matched case-insensitively and ignore punctuation/spaces. The Excel typo `Contract Vaue` is also recognized.
- Import limit: 5 MB and 1,000 non-empty rows per `.xlsx` file.
- Required values: Projects need Job No, Project Name, Client Name; Employees need Employee ID and Name; Equipments need Registration No and Vehicle Details. Optional fields may be empty.
- Dates support Excel date cells, numeric date serials, `YYYY-MM-DD`, and day-first `DD/MM/YYYY`.
- Duplicate imports **skip** existing records rather than overwrite them. Projects match by Job No + Rev; employees by Employee ID; equipment by Registration No.
- The new PostgreSQL migration preserves previous records and schedule assignments; employee `trade` is renamed to `designation`, and equipment `name`/`category` become `vehicleDetails`/`vehicleType`.
- The fields Contract Value, Limit, and Model Year currently preserve Excel values as text, without assuming a currency or measurement unit.
- Format identifiers as **text** in Excel to preserve leading zeroes (the downloadable templates are preformatted).

Apply database schema changes after pulling new code: `npm run db:deploy`.

**Security:** This is still an unauthenticated prototype. Do not publish it or import real employee/client information without adding authentication and access controls.
