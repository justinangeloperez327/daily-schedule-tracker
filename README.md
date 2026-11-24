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

## Authentication

Every page and API route requires sign-in.

- **First run:** open the app and you are sent to `/login`. While the `User` table is empty, the page shows **Create administrator**. That first account is an admin. Setup turns itself off once any user exists.
- **Users page** (`/users`, admins only): add users, change role (Admin / User), reset passwords, deactivate or delete accounts. Resetting a password or deactivating a user signs them out everywhere.
- Passwords are stored as scrypt hashes. Sessions are server-side (`Session` table); the browser holds only a random token in an httpOnly cookie, and the database stores its SHA-256 hash. Sessions last 14 days.
- `src/proxy.ts` redirects signed-out visitors to `/login` (cookie check only). Each API handler re-validates the session against the database with `requireUser()` / `requireAdmin()`.

## Site Daily Reports

**Site Reports** (`/site-reports`) is separate from the daily schedule for now. A job order can have several reports on the same date (for example, separate crews):

- **Job order no.** — searchable project picker (job order no., project, client, SO no.)
- **Date**
- **Activity description** — optional free text (may later be replaced by the per-project tracker)
- **Remarks** — optional
- **Labour** — 5 rows shown by default, add as many as needed (minimum 1 employee). Each row: employee, time in, time out, OT hours (0–12 in half-hour steps). Worked hours are shown per row; overnight shifts are allowed. An employee can appear once per report; Inactive/Terminated employees can't be picked.
- **Equipment** — optional; select by vehicle no. (the equipment Fleet number) with its description shown.

Employees, equipment and projects used in a report can't be deleted until the report is changed or removed.

Migration `20261124053654_auth_and_site_daily_reports` adds `User`, `Session`, `SiteDailyReport`, `SiteReportLabour` and `SiteReportEquipment`. It only creates tables; existing data is untouched. Migration `20261124061810_allow_multiple_site_reports_per_day` then removes the one-report-per-job-per-date rule.

**Migration note:** The earlier prototype stored schedules only in the browser's `localStorage`. Those entries are **not automatically imported** into PostgreSQL. The new version leaves the old browser data untouched; existing entries must be transferred separately if needed.

No seeded demo records are created in the database. Set up projects, employees and equipments before scheduling.

## Import Excel into Projects, Employees, and Equipments

Each catalog page now has **Import Excel** and a **Download Excel template** option. Upload an `.xlsx`, inspect the first five rows in the preview, then select **Confirm import**. The table reloads and displays the number added.

**Project columns:** So No, Job No, Rev, Client Name, Main Category, Sub Category, Project Name, Descriptions, Contract Value, Payment Terms, Status, Project In Charge.

**Employee columns:** Employee ID, Name, Designation, Location, Category, Joining Date, Remarks.

**Equipment columns:** Fleet, Description, Rate per Day, Rate per Hour.

- Headers are matched case-insensitively and ignore punctuation/spaces. The Excel typo `Contract Vaue` is also recognized.
- Import limit: 5 MB and 1,000 non-empty rows per `.xlsx` file.
- **Incomplete Excel rows are allowed:** blank Project Name, Client Name, Employee Name, or Vehicle Details are imported as empty values and shown as a dash in the table. Empty rows are ignored. Preview shows a warning with the number of incomplete rows. Use the row's Edit or Delete action for cleanup. New records added manually still require the key fields.
- Dates support Excel date cells, numeric date serials, `YYYY-MM-DD`, and day-first `DD/MM/YYYY`.
- **Duplicate rows and identifiers are accepted.** Every valid Excel row is inserted as a separate record. The final table column provides Edit and Delete actions for managing records individually. Scheduled items must be unassigned before deletion.
- The new PostgreSQL migration preserves previous records and schedule assignments; employee `trade` is renamed to `designation`, and equipment `name`/`category` become `vehicleDetails`/`vehicleType`.
- The fields Contract Value, Limit, and Model Year currently preserve Excel values as text, without assuming a currency or measurement unit.
- Format identifiers as **text** in Excel to preserve leading zeroes (the downloadable templates are preformatted).

Apply all database schema changes, including the migration that removes identifier uniqueness, after pulling new code: `npm run db:deploy`.

**Security:** Imports require a signed-in user. Review who has accounts before importing real employee or client information.

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

## Responsive layout and denser Employees rows (Nov 2026)

The app now has a mobile navigation menu and narrower responsive page gutters. Schedules, Projects and Equipments keep their wide desktop tables but offer **keyboard-focusable, internally horizontal-scrollable tables** and a swipe hint on smaller screens. The Create/Edit Schedule buttons and date/summary fields stack on small screens; the wide editable dispatch table remains scrollable inside its card. Employees has a compact responsive search/filter/footer layout. Its default **Comfortable** row height is now approximately **36px** with 2px vertical cell padding and a 28px row-action trigger; **Compact** is approximately **32px** with zero vertical cell padding. Previous 48/40px hard-coded row minimums were removed. Employee row hovering and all CRUD/import behavior remain unchanged. No migrations or new dependencies are required for these layout-only changes.

## Consistent table density (November 2026)

All tables now use tighter headers and cell padding matching the Employees directory. The Schedules register and Projects/Equipments directories provide an independent **Comfortable / Compact** density selector; ordinary data rows are approximately 36/32px respectively when text stays on one line. Long values in the Projects/Equipments directories are truncated in the table, with full values available via the existing title tooltip and Edit form. Employees retains its existing density selector.

The **Create/Edit Schedule** table also has compact headers, reduced cell spacing, shorter time inputs and shorter select controls. Its job rows remain naturally taller because foremen, labourers and time controls are vertically stacked; those controls cannot fit inside a fixed 36px row without hiding inputs. The Excel import preview now uses reduced padding and retains the row hover highlight. Table overflow remains confined to a focusable horizontally scrollable region on smaller screens. This is UI-only; no schema or database migration is needed.

## Quiet Technical blue design (Nov 2026)

The application uses a restrained blue engineering-operations style: Deep Navy `#172B45` for headings and primary actions, Steel Blue `#365F91` for technical accents, Soft Blue `#EAF2FC` for interactive hover states, a pale `#F5F8FC` page background, white cards, and `#DCE5EF` borders. Typography uses **Geist Sans** and **Geist Mono** via Next.js built-in `next/font/google` integration (no added library). Small technical section labels and monospace metadata add precision without extra decoration.

All table header and body cells have a little more horizontal breathing room (typically **16 px per side**, while retaining the established compact vertical height and Comfortable/Compact choices). Tables remain horizontally scrollable on narrow screens. All existing CRUD, search, sorting, pagination, Excel import/export, dispatch assignments, and manual-only Vercel deployment behavior are unchanged. This is a styling-only update; no database migration was added.

## Create/Edit Schedule: job and resource selection (Nov 2026)

The dispatch table uses fixed, deliberate column widths; **Select Job** has a wider 380px column and, after selection, shows the full project name, SO number and client beneath the searchable Job No/SO No/Project Name combobox. All dispatch cells are **top-aligned** so additional resources extend downward rather than centering shorter fields.

**Equipment** now uses exactly the same inline searchable, vertically stacked selectors as Labour, with **+ Add Equipment** and individual removal buttons. The equipment combobox searches vehicle details, registration number, and vehicle type. New jobs start with one empty equipment selector. Equipment selection remains mandatory (one or more), and duplicate equipment selections within a job are disabled. Existing equipment assignments are retained in Edit and Excel export.

**Foreman** selectors list only employees whose Designation is **Site Foreman** (case-insensitive, allowing normal whitespace/hyphen variations). Existing nonmatching assignments are not silently removed; the editor displays a warning and requires replacement before saving. Labour still lists the full employee directory. The current Prisma relationships and API payload are unchanged, so no migration or additional library is needed.

## Project, employee and equipment register pagination (Nov 2026)

The **Projects**, **Employees**, and **Equipments** directories all show **10 rows per page by default**. Their footer pagination offers **10 / 25 / 50 / 100** rows per page, previous/next navigation, page count, and a filtered-result range. Searching or changing page size resets the list to page one, and deleting/filtering items cannot leave the user stranded on an invalid page. Pagination happens in the client over the existing loaded API records; no database changes are needed.

In the **Projects** directory, **Rev**, **Payment Terms**, and **Contract Value** are temporarily hidden from the register without being deleted or removed from the add/edit/import data. The remaining project fields **wrap rather than truncate**, including full project descriptions. Select a project name or the View icon to open a **full-page Project Details** view with complete visible-field values, including long text. The three hidden columns are also omitted from that view for now. The wide table remains scrollable on smaller screens.

## Compact project and equipment row actions (Nov 2026)

The **Projects** register additionally hides **SO No** and **Descriptions** (along with Rev, Payment Terms, and Contract Value). These fields are retained in the database, searchable register records, Excel imports, and add/edit forms. **SO No and Description remain available on the full-page Project Details view**, where users can read their complete values.

Project and Equipment rows now use a single accessible **⋯ Actions** dropdown, sharing the same control as Employees. Project menus provide **View details, Edit, Delete**; Equipment and Employee menus provide **Edit, Delete**. Each menu supports keyboard navigation and is rendered above the scrolling table. Choosing Delete opens an explicit confirmation dialog with Cancel and a red Delete action; deletion errors are shown in that dialog. No new dependencies or database migrations are necessary.

## Unified actions and sortable tables (Nov 2026)

- All actionable record tables use a compact, keyboard-accessible **⋯ Actions** dropdown: Projects (View details/Edit/Delete), Employees (Edit/Delete), Equipments (Edit/Delete), and Schedules (Open schedule/Delete). Existing delete-confirmation dialogs remain for Projects, Employees, Equipments; Schedules now also has a confirmation dialog with a count of affected dispatches.
- The **Create/Edit Schedule** dispatch table uses the same ⋯ menu, with **Duplicate job** (inserts a copy after the original with fresh row/selector keys and no existing persisted job ID) and **Remove job** (confirmation before removing the job from the editable form). Removal takes effect in the database only when the schedule is saved.
- All visible data columns in the Projects, Equipment, Employees, and Schedules registers are sortable by clicking the header. Ascending/descending icons and `aria-sort` indicate the active order. Text sorts case-insensitively and uses natural numeric ordering; empty values are placed last. Numeric schedule totals sort numerically, and the Day/Night column sorts by day count followed by night count. Filtering and sorting occur **before pagination**, with page one selected after choosing a new sort.
- The **Create/Edit Schedule** table is sortable by original row position, job, assigned resource counts, shift, scope, and start time. Sorting is display-only: the persisted order, stable job keys, selections and Excel export order remain unchanged. Use the **#** header to return to the original job order.
- The Excel import preview is intentionally read-only and retains source worksheet row order and row numbers. It has no editable record actions or sorting, to avoid confusing the preview with the master-data registers.

No third-party dependencies, API changes, or new database migrations were added. Manual Vercel deployment remains unchanged.

## Card-based Schedule Planner (November 2026)

**Create Schedule** and **Edit Schedule** now use one responsive **job card per dispatch** rather than a 1945px editable table. Each card groups the Project/Job lookup, Scope, Day/Night shift, Camp start, Work start, Work end, and three independently searchable resource panels:

- **Foremen** — a search field plus a fixed-height, vertically scrollable list of employees whose designation is `Site Foreman`. Search by name/employee ID/designation, tick checkboxes to assign, untick to remove.
- **Labourers** — a separate search field and scrollable roster from the employee directory; multiple selections supported, displaying employee IDs and designations.
- **Equipment** — a separate search field and scrollable equipment directory, showing registration and vehicle type/details and allowing multiple selections.

Selections are shown at the top of each list, along with a selected-count badge and a per-job resource count. Resources also selected on another job **in the current unsaved plan** display an "Also selected in Job N" note. This is **not** authoritative availability across previously saved schedules, leave records, maintenance records, or external jobs. The assignment limit and at-least-one-resource requirements remain enforced by existing validation, and old ineligible foreman assignments stay visible and removable with a warning.

Every job card offers the same **⋯ menu** for Duplicate Job / Remove Job; deletion requires confirmation. Job cards can be sorted using the sort selector and direction control without changing underlying saved/exported job order. The page remains responsive and follows the navy/steel-blue design. Save, Edit and Excel export still use the existing API payloads and database schema; no additional dependencies or database migrations are required. Vercel auto-deploy remains disabled; deploy changes manually.

## Shared sticky resource planner (Nov 2026)

Create/Edit Schedule uses a desktop-first **75%/25% grid**: job planning cards on the left and **one shared Resource Assignments sidebar** on the right. The panel is sticky below the 64px navigation bar, with a viewport-height cap and its own scrollbar; it follows the page while scrolling through jobs. The shared panel has separate **Foremen**, **Labourers**, and **Equipment** search fields and independent scrollable checklists.

Click **Select job** on any job card to make it the active target. The selected card has a blue outline, and the shared panel header displays its job number and project name. Assignment checkboxes update **only that active job**; another card retains its prior assignments when you switch jobs. Every card displays a compact summary of its selected people and equipment (up to five names per resource type, with an overflow count). Adding or duplicating a job automatically selects the new job. If the active job is removed, the planner falls back to the first remaining job.

Existing search/filter rules, Site Foreman eligibility, duplicate-in-plan indicators, Save/Edit, Excel export, and persisted job order are unchanged. No new dependencies, API modifications or database migrations. This desktop-oriented workspace uses a stacked fallback on narrower viewports without changing the core workflow. Automatic Vercel deployments remain disabled.

## Fixed planner width and tabbed resources (Nov 2026)

The desktop Create/Edit Schedule workspace keeps a **3/4-width job planner** at left and **1/4-width shared sticky Resource Assignments sidebar** at right. The previously full-width footer instructions, **Add Job**, **Cancel**, and **Create Schedule / Save Changes** controls are now located **inside the left job-planner column**. There are no bottom action bars spanning underneath the right resource panel.

The sidebar has keyboard-navigable **Foremen | Labours | Equipments** tabs. Only the selected category is displayed; changing tabs keeps the search text already entered in other tabs and retains each job's assignments. Each tab displays one full-height searchable checkbox list with its own scrollbar, inside a sidebar capped to the viewport height beneath the main navigation. Selecting a different job updates which job that shared panel edits; the other jobs' resource selections remain unchanged. The layout and blue theme are preserved, with a stacked fallback for non-desktop widths. No database or API changes, no additional dependencies, no automatic Vercel deployment.

## Drag-and-drop resource assignment (Nov 2026)

The Create/Edit Schedule screen no longer displays the **Daily job planning** toolbar (heading, sort selector, sort-direction button and top Add Job button). The existing bottom **Add Job**, **Cancel** and **Create Schedule / Save Changes** controls remain within the left 75%-width job-planner column. Resource assignment tabs remain in the sticky right-hand 25%-width sidebar.

**Foremen, Labours and Equipments** lists show draggable **resource cards, not checkboxes**. Each card displays its name and secondary employee/vehicle identifiers, a drag handle and assignment status. Drag a card from the right sidebar onto the **matching dashed Foremen/Labourers/Equipment zone** on any job card. The job card displays all assigned people/equipment as removable rows; click **X** to unassign.

A resource already assigned to a job in the **current daily plan** is shown disabled (muted) and cannot be dragged again. The same employee is considered assigned whether they appear under Foremen or Labourers, and equipment is tracked independently. An unassigned resource becomes draggable immediately. Previously saved duplicates are not silently removed, but cannot be recreated by dragging. **Duplicate Job** copies project/shift/scope/times without copying resources so it doesn't double-book people or equipment.

For keyboard use or as an alternative to dragging, click an available resource card to assign it to the currently selected job. The same validation applies: resource eligibility, no duplicate assignment, and original per-job caps. A drop to a mismatched category has no effect. The fixed job order is retained for saving and Excel export; dragging does not reorder jobs. Assignment availability currently reflects **only jobs in the plan being edited**, not other stored schedules, leave or maintenance.

Implementation uses native browser drag events; no extra library or database migration is needed. No automatic Vercel deployment.

## Compact Resource Assignments sidebar (Nov 2026)

The shared sticky right-hand panel now contains only the **Resource Assignments** title, **Foremen | Labours | Equipments** tabs, search field, and scrollable draggable resource cards. Removed the repeated selected-job metadata (Job number, project name, and "checking resources" helper) and the duplicate in-panel category heading/assigned-count badge. Redundant instructional copy and footer counts are also removed to give the list more vertical space. Job cards continue to show the active selection and per-category assigned resources. Drag, click-to-assign, global-in-plan disabled state, and unassign behavior are unchanged.

## Daily Target and compact job card header (Nov 2026)

The Create/Edit Schedule job-card header now shows **only "JOB 01 / DISPATCH" and its ⋯ Actions menu**. The duplicate project name/client summary and "N assigned / Selected job" button were removed. Click the job-number heading to make that card the active target for clicking a resource in the shared sidebar; drag-and-drop directly into any job still works. The active card keeps its subtle navy outline.

A multiline **Daily Target** text area now sits beneath Scope of Work in each job card. It stores free-form daily work targets separately from the broader scope (optional, up to 5,000 characters). The value is included in New/Edit form state, API payload validation, schedule creation and updates, schedule details DTOs, and Excel export in a dedicated **Daily Target** column. The database stores it on `ScheduleJob` with `@default("")` so existing jobs retain a blank target until edited. A new additive Prisma migration is automatically applied by the existing manual Vercel build command (`prisma migrate deploy`). CI's database smoke test now verifies target persistence and the empty default. No existing project description is modified.

## Assigned employee details in each job card (Nov 2026)

The job card's **Assigned resources** area shows **Employee ID | Name | Position / Designation** as aligned columns for both **Foremen** and **Labourers**, with the existing individual **X** remove control. Values come from the employee master-data record (`employeeCode`, `name`, `designation`), not the internal database ID. Missing fields display a dash rather than fabricated values; long names and designations wrap without truncation. Equipment retains its simpler item list. Drag/drop assignment and the sticky tabbed sidebar are unchanged.

## Project category replaces manual schedule scope (Nov 2026)

**Scope of Work** is no longer an editable field in Create/Edit Schedule. After choosing a project, the job card displays its **Main Category** and **Subcategory** directly from project master data, as read-only context, while keeping the separate multiline **Daily Target** for the specific activities planned that day. In the Excel dispatch export, the former Scope column is replaced by **Main Category** and **Subcategory** populated from the selected project; the Daily Target column stays.

The schedule API no longer requires a manually entered scope (`scope` defaults to an empty string for new API requests). The legacy `ScheduleJob.scope` database field and existing historical scope values remain intact; editing an older job preserves its previous stored scope, although the field is no longer shown or editable. No database migration is needed. Existing project metadata and assignments remain unchanged.

## Equipment fleet and rates register (Nov 2026)

Equipment has exactly four visible columns, used consistently in the table, Add/Edit form, Excel template and import preview: **Fleet, Description, Rate per Day, Rate per Hour**. Rates are optional, non-negative numeric values limited to two decimal places; PostgreSQL uses `DECIMAL(12,2)` to retain currency-style precision, but the app does not impose a currency or compute totals. Rate cells sort numerically rather than alphabetically.

An additive Prisma migration creates these four fields and preserves equipment IDs, all existing job-to-equipment assignments and the old data columns. For existing equipment it copies **Registration No -> Fleet** and **Vehicle Details -> Description**; the original registration/vehicle details/type/limit/model/year/remarks remain stored for backward compatibility but are not editable in the new form. Rates are intentionally blank (`NULL`) until entered. The legacy fields receive empty-string defaults to allow new four-field records without losing the legacy schema. The equipment search and drag cards show Fleet/Description, with optional daily and hourly rate metadata; dispatch Excel exports use the same descriptive equipment label.

The equipment import parser also recognizes legacy `Registration No` and `Vehicle Details` column headings for Fleet and Description. Rates can be omitted in imported sheets. Existing code that looks up equipment by ID remains compatible. No automatic Vercel deployments; run a **manual** deployment to apply the new migration through `npm run vercel-build`.

## Project search and compact resource cards (Nov 2026)

- **Project / Job No picker:** Structured options display **Job No.**, meaningful **Project Name** (or Client for unnamed projects), followed by Client and SO No. only once. Searching covers Job No., Project Name, Client, and SO No., with match highlighting, sensible prefix ordering, keyboard navigation, and a scrollable 480px-max menu. The selected input displays Job No. and Project (or Client fallback). Existing schedule CRUD is unchanged.
- **Resource Assignments sidebar:** Foremen, Labours and Equipments appear as separate, understated **draggable cards**, with subtle borders, a hover state and spacing between cards. The six-dot drag-handle icon and repeated drag instructions are removed; the **whole available card is still draggable or clickable**. Assigned resources remain visibly disabled until removed from their job. **Equipment rates are not shown in resource cards**; rates remain in the Equipment master register and database. No migration or new dependencies. Vercel auto-deploy remains disabled.

## Uniform job borders and direct resource assignment (Nov 2026)

Every Create/Edit Schedule job card now has the **same fixed steel-blue 1px border** (`#365F91`). Adding, duplicating, or clicking a job does not mark one job as uniquely selected, change its border, or animate between selected/unselected states. All job cards accept Foremen, Labourers and Equipment drag-and-drop assignments directly in their matching zones.

The former active-job state was removed from the shared resource sidebar. The draggable roster is global to the current plan; assignments remain unique across its jobs. As a keyboard/click alternative to dragging, a user can choose an available resource card and then use the **Assign here** button on that resource type within the intended job card. Picking a resource never selects a job or changes any job's border. Existing assigned-resource removal, saving, Excel export, category tabs, and drag validation remain unchanged. No schema changes or new dependencies; manual Vercel deployment remains required.
