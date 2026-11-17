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

Each catalog page now has **Import Excel** and a **Download Excel template** option. Upload an `.xlsx`, inspect the first five rows in the preview, then select **Confirm import**. The table reloads and displays the number added.

**Project columns:** So No, Job No, Rev, Client Name, Main Category, Sub Category, Project Name, Descriptions, Contract Value, Payment Terms, Status, Project In Charge.

**Employee columns:** Employee ID, Name, Designation, Location, Category, Joining Date, Remarks.

**Equipment columns:** Registration No, Vehicle Type, Vehicle Details, Limit, Model Year, Remarks.

- Headers are matched case-insensitively and ignore punctuation/spaces. The Excel typo `Contract Vaue` is also recognized.
- Import limit: 5 MB and 1,000 non-empty rows per `.xlsx` file.
- **Incomplete Excel rows are allowed:** blank Project Name, Client Name, Employee Name, or Vehicle Details are imported as empty values and shown as a dash in the table. Empty rows are ignored. Preview shows a warning with the number of incomplete rows. Use the row's Edit or Delete action for cleanup. New records added manually still require the key fields.
- Dates support Excel date cells, numeric date serials, `YYYY-MM-DD`, and day-first `DD/MM/YYYY`.
- **Duplicate rows and identifiers are accepted.** Every valid Excel row is inserted as a separate record. The final table column provides Edit and Delete actions for managing records individually. Scheduled items must be unassigned before deletion.
- The new PostgreSQL migration preserves previous records and schedule assignments; employee `trade` is renamed to `designation`, and equipment `name`/`category` become `vehicleDetails`/`vehicleType`.
- The fields Contract Value, Limit, and Model Year currently preserve Excel values as text, without assuming a currency or measurement unit.
- Format identifiers as **text** in Excel to preserve leading zeroes (the downloadable templates are preformatted).

Apply all database schema changes, including the migration that removes identifier uniqueness, after pulling new code: `npm run db:deploy`.

**Security:** This is still an unauthenticated prototype. Do not publish it or import real employee/client information without adding authentication and access controls.

## Deployment prerequisites (Vercel)

Next.js and Prisma do not provision PostgreSQL automatically. Create a managed PostgreSQL database (for example, Neon through Vercel Marketplace), connect it to the Vercel project, and configure `DATABASE_URL` for the deployment. If your provider exposes a direct, unpooled connection, configure `DIRECT_URL` for migrations.

Run `npm run db:deploy` against that database **before** using the app; this is a separate controlled step from the Next.js build. Automatic Vercel deployments are disabled in `vercel.json`. Never commit credentials or put them in `NEXT_PUBLIC_*` variables.

## Fix: live database tables are missing or outdated

The GitHub CI pipeline uses **an isolated temporary PostgreSQL database**. It does not update your Vercel production database. Deploying a Next.js build also does not run Prisma migrations automatically.

To apply the existing migrations to **the exact PostgreSQL instance used by the deployed app**:

1. Confirm the database provider is running and the Vercel project's production `DATABASE_URL` points to it. Never commit a database URL or paste it into an issue/chat.
2. In GitHub repository **Settings → Environments**, create or open the `production` environment. Add a protected secret named `DATABASE_URL` using the same database credentials/target as Vercel. If your provider offers a separate direct (nonpooling) connection, add `DIRECT_URL` as well. Require a reviewer on the production environment if your plan supports it.
3. Open **Actions → Apply PostgreSQL migrations (manual) → Run workflow**. Use the **main** branch and enter `MIGRATE` in the confirmation input. The workflow has no push/schedule trigger.
4. Confirm **Apply committed Prisma migrations** and **Verify migration status** pass. Refresh the deployed app and check the Projects, Employees and Equipments pages.

Alternatively, apply migrations from a trusted local terminal with correctly configured `.env`: `npm install && npm run db:deploy && npx prisma migrate status`.

Do **not** run `prisma db push` to repair production. The migrations preserve existing assignments and remove only the catalog identifier uniqueness constraints that prevented duplicate Excel imports.

## Vercel-managed migrations on each manual deploy

Vercel's build command (set in `vercel.json`) runs `npm run vercel-build`, which performs these actions in order: `prisma generate`, `prisma migrate deploy`, and `next build`. It applies pending committed SQL migrations to PostgreSQL before deploying the Next.js build. **No separate migration workflow is needed for normal manual Vercel releases.**

- In Vercel's **Production** environment variables, configure `DATABASE_URL` for the application's PostgreSQL database and, when provided, `DIRECT_URL` for migrations. Verify that both target the same intended database/branch/schema. Do not commit or expose their values.
- Keep Git deployments disabled (`vercel.json` has `git.deploymentEnabled=false`). Run your normal manual production deployment; it applies pending migrations as part of the Vercel build.
- Database changes are **not rolled back** by reversing a Vercel deployment. Review migrations before releasing, back up important data, and keep the production database separate from preview deployments.
- `npm run build` remains a regular Next.js-only local build. GitHub CI uses `npm run vercel-build` against a temporary PostgreSQL database to test this deployment sequence without touching production.
- The older manually triggered GitHub migration workflow remains available as an emergency/manual fallback, but is not required for normal deployments.

## Schedules: list + daily dispatch table

The Schedules page is now a **register of schedule sheets** with date, unique job count, team dispatch count, day/night breakdown and actions. The upper-right **Create Schedule** button opens a full-page dispatch editor.

Each schedule contains one or more **team dispatch rows**:

- **Select Job**: choose an existing record from Projects (multiple dispatch rows may use the same job)
- **Foremen**: select any number of employees for the foreman role
- **Labours**: select any number of employees for the labour role
- **Equipment**: optional multi-selection, retained from the prior scheduler
- **Day / Night**: shift per dispatch row
- **Scope**: Bus Shelter, Substation, Guardrail, Wire Rope, Gantry, Camera Cladding, To Be Followed, or a custom scope
- **Time**: three vertically stacked time inputs — Camp start, Start time, End time
- **Action**: delete a dispatch row (saved when the schedule is saved)

The editor supports adding multiple rows, editing existing sheets, exporting an Excel dispatch table, and deleting a schedule from the register. Jobs counts represent *distinct selected projects*; team dispatches count the rows. The editor permits overnight shifts where End time is earlier than Start time.

Migration `20261116000000_schedule_dispatch_sheets` groups existing schedule jobs into one sheet per date without dropping their employee/equipment assignments or existing row identifiers; previous free-text scopes remain editable as custom values. A new `ScheduleForeman` join records foreman assignments separately from labour assignments. No automatic conversion of existing labour assignments to foremen is attempted. The migration is applied on the next manual Vercel build using the existing `vercel-build` command; verify `DATABASE_URL` / `DIRECT_URL` first.

## Full-width data tables and hover feedback

All data tables (schedule register, dispatch editor, project/employee/equipment directories, and Excel import preview) use the available horizontal layout. Long content wraps instead of being truncated, and row padding is more comfortable. A light-blue hover/focus background highlights active rows without obscuring values. Wide tables retain horizontal scrolling on smaller screens and longer register layouts. This is a presentation-only change; no Prisma migration is required.


## Labours inside schedule dispatch rows

In **Create / Edit Schedule**, each dispatch row starts with one inline **Select labour** dropdown in the Labours column. **Add Labour (+)** places another dropdown directly underneath in the same table cell. Additional dropdowns have individual Remove buttons; at least one selector always remains visible. A dispatch must contain at least one selected employee before saving, up to 150 unique labour assignments per dispatch. Employees already selected in the same dispatch are disabled in the other dropdowns. Empty optional extra dropdowns are ignored when saving and exporting. The foremen and equipment columns retain their existing multi-select controls. No database migration is needed.


## Database relationship hierarchy (17 Nov 2026)

The logical and physical PostgreSQL tables now match the schedule hierarchy:

- **Schedule (1) → ScheduleJob (many):** a schedule has a date and many job rows.
- **ScheduleJob (many) → Project (1):** every scheduled job selects an existing Project; the same Project may appear on multiple schedules or dispatch rows.
- **ScheduleJob (1) → JobForeman (many) → Employee (1):** assign one or multiple foremen to a job.
- **ScheduleJob (1) → JobLabour (many) → Employee (1):** assign one or multiple labourers to a job.
- **ScheduleJob (1) → JobEquipment (many) → Equipment (1):** assign one or multiple equipment items to a job.

The API enforces **at least one job per schedule and at least one foreman, labourer and equipment item per new/edited job**. Junction-table composite primary keys prevent duplicate assignments within each role; foreign keys preserve resource integrity. Foremen and labourers reference the same Employees master data with independent roles. The existing Labour dropdowns (+ Add Labour) are preserved.

Migration `20261117010000_schedule_job_relationships` **renames** the previous `ScheduleSheet`, `Schedule`, `ScheduleForeman`, `ScheduleEmployee`, `ScheduleEquipment` tables and foreign-key columns; it does not drop or rebuild them. Existing IDs, job data, employee/equipment assignments and schedules are preserved. Historical jobs missing a foreman, labourer or equipment are not backfilled with invented records; assign the missing resources before editing and saving those jobs. The next **manual Vercel deployment** will run the migration using the configured production database URL. Automatic Vercel Git deployments remain disabled.

The GitHub CI workflow runs a rollback-only PostgreSQL smoke test proving that a schedule can contain multiple job assignments, each with multiple foremen, labourers and equipment. Deleting the schedule cascades to its assignment records without deleting employee/equipment catalog records. The smoke test is restricted to GitHub Actions and its isolated localhost PostgreSQL container.

## Searchable schedule project and employee selectors

In Create / Edit Schedule, the **Project** column uses a searchable combobox that filters by Job No., SO No., Project Name, and client name. Each match displays its job number, project name, SO number and client. **Foremen** and **Labours** use the same keyboard-accessible searchable combobox; each scheduled job starts with one selector in each column, with **+ Add Foreman** or **+ Add Labour** buttons below. Extra rows can be removed, and duplicate people in the *same role within a job* are disabled. Each role requires at least one actual selection. Equipment retains its existing multi-select dialog. The combobox dropdown is rendered above the scrolling table to avoid clipping, accepts typing, arrow keys, Enter, and Escape. No database migration is required for this UI change.

## Employees directory redesign (2026-11-17)

The Employees route now uses `src/components/employee-directory.tsx` rather than the shared Projects/Equipments catalog table. The directory includes:

- Comfortable (approximately 48 px) or Compact (approximately 40 px) rows, with a 40 px header and light-blue hover/focus highlight.
- A fixed-width table with flexible Name column and a narrow right-aligned Actions column; sideways scrolling on smaller screens.
- Sorting by clicking headers, independent filters for Designation, Location, Category and Status, search across Employee ID/Name/Designation, and 10/25/50-row pagination.
- An accessible Columns chooser. Columns with the same value for every employee are hidden by default (except Employee ID and Name, which remain required). Remarks is hidden by default but remains available through Columns and the Name tooltip.
- Colored Status badges: Active, Inactive, On leave, Terminated and Not set. Joining Date is shown as day/month/year or a muted dash when missing.
- One ellipsis Actions menu per row (Edit/Delete), with an accessible confirmation dialog for deletion. Deletion is blocked by existing assignment foreign keys until those assignments are removed.
- Existing Add/Edit, Excel import, delete and search workflows. Import Excel remains secondary; Add Employee is the primary action.

**Database migration** `20261117020000_employee_directory_status` adds `Employee.status` without replacing the `remarks` field. Existing rows with Remarks exactly equal to a recognized status are backfilled; all other old rows remain `Not set`. New manually added employees default to `Active`, which can be changed in the form. Updated Excel templates have both Status and Remarks; existing Excel files lacking either/both optional columns are still accepted. A recognized status entered in the Remarks column of an old Excel file is preserved in Remarks and also mapped into Status. No new frontend libraries were installed.

Run the existing manual Vercel deployment process to apply the migration to the configured production database and deploy the updated application. Git-triggered automatic Vercel deployments remain disabled.
