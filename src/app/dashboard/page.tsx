import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, CheckCircle2, ClipboardPlus, CircleAlert } from "lucide-react";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { siteToday } from "@/lib/site-date";
import { dateLabel, timeLabel } from "@/lib/schedule";
import { trackerTypeLabels, type TrackerType } from "@/lib/project-tracker";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MILESTONES_PER_ITEM = 5;

function Tile({ label, value, sub, tone, href }: {
  label: string; value: React.ReactNode; sub: React.ReactNode; tone?: "warn" | "ok"; href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-primary">{value}</p>
      <p className={cn("mt-1 truncate text-xs", tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "text-muted-foreground")}>{sub}</p>
    </>
  );
  const className = "block min-w-0 rounded-xl border border-border bg-white px-5 py-4";
  return href
    ? <Link href={href} className={className + " transition-colors hover:border-[#BFD5EE] hover:bg-[#FBFDFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"}>{body}</Link>
    : <div className={className}>{body}</div>;
}

function Card({ title, action, children, className }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-white", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login?next=/dashboard");

  const prisma = getPrisma();
  const today = siteToday();
  const [schedules, todaysReports, recentReports, projects, activeEmployees, trackerItems] = await Promise.all([
    prisma.schedule.findMany({
      where: { date: today },
      select: {
        id: true,
        jobs: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true, projectId: true, shift: true, timeIn: true, timeOut: true,
            project: { select: { jobNo: true, name: true, clientName: true } },
            _count: { select: { foremen: true, labours: true, equipments: true } },
          },
        },
      },
    }),
    prisma.siteDailyReport.findMany({
      where: { date: today },
      select: { id: true, projectId: true, labours: { select: { otHours: true } } },
    }),
    prisma.siteDailyReport.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 6,
      select: {
        id: true, date: true,
        project: { select: { jobNo: true, name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { labours: true, equipments: true } },
      },
    }),
    prisma.project.findMany({ select: { status: true } }),
    prisma.employee.count({ where: { status: "Active" } }),
    prisma.projectTrackerItem.findMany({
      select: {
        projectId: true, trackerType: true, wirStatus: true, updatedAt: true,
        siteMeasurementDate: true, drawingToProductionDate: true, deliveryDate: true, installationDate: true,
        project: { select: { jobNo: true, name: true } },
      },
    }),
  ]);

  // Today's dispatch, one row per job (a project may have several crews).
  const jobs = schedules.flatMap((schedule) => schedule.jobs.map((job) => ({ ...job, scheduleId: schedule.id })));
  const reportByProject = new Map(todaysReports.map((report) => [report.projectId, report.id]));
  const dispatchedProjects = new Set(jobs.map((job) => job.projectId));
  const reportedProjects = [...dispatchedProjects].filter((id) => reportByProject.has(id)).length;
  const missingReports = dispatchedProjects.size - reportedProjects;
  const labourToday = todaysReports.reduce((sum, report) => sum + report.labours.length, 0);
  const otToday = todaysReports.reduce((sum, report) =>
    sum + report.labours.reduce((inner, labour) => inner + Number(labour.otHours), 0), 0);
  const activeProjects = projects.filter((project) => /ongoing|progress|active|open/i.test(project.status)).length;

  // Tracker progress per project, most recently updated first.
  const trackers = new Map<string, { projectId: string; type: string; label: string; items: number; done: number; approved: number; updated: number }>();
  for (const item of trackerItems) {
    const entry = trackers.get(item.projectId) ?? {
      projectId: item.projectId, type: item.trackerType,
      label: (item.project.jobNo ? item.project.jobNo + " — " : "") + (item.project.name || "Unnamed project"),
      items: 0, done: 0, approved: 0, updated: 0,
    };
    entry.items += 1;
    entry.done += [item.siteMeasurementDate, item.drawingToProductionDate, item.deliveryDate, item.installationDate]
      .filter(Boolean).length + (item.wirStatus === "Approved" ? 1 : 0);
    if (item.wirStatus === "Approved") entry.approved += 1;
    entry.updated = Math.max(entry.updated, item.updatedAt.getTime());
    trackers.set(item.projectId, entry);
  }
  const trackerRows = [...trackers.values()].sort((a, b) => b.updated - a.updated).slice(0, 6);

  return (
    <main className="w-full min-w-0 px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-8">
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="technical-eyebrow mb-1.5">{dateLabel(today).toUpperCase()}</p>
          <h1 className="text-[27px] font-semibold tracking-[-0.04em] text-primary sm:text-[32px]">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Today&apos;s dispatch, site reports and tracker progress.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/schedules/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-white px-4 text-sm font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <CalendarPlus className="size-4" aria-hidden="true" /> Create schedule
          </Link>
          <Link href="/site-reports/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <ClipboardPlus className="size-4" aria-hidden="true" /> New site report
          </Link>
        </div>
      </div>

      <section aria-label="Today at a glance" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Jobs dispatched today" value={dispatchedProjects.size}
          sub={jobs.length + " team dispatch" + (jobs.length === 1 ? "" : "es")}
          href={schedules[0] ? "/schedules/" + schedules[0].id : "/schedules"} />
        <Tile label="Site reports today" value={<>{reportedProjects}<span className="text-base font-normal text-muted-foreground"> / {dispatchedProjects.size}</span></>}
          sub={dispatchedProjects.size === 0 ? "Nothing dispatched" : missingReports ? missingReports + " still missing" : "All jobs reported"}
          tone={dispatchedProjects.size === 0 ? undefined : missingReports ? "warn" : "ok"} href="/site-reports" />
        <Tile label="Labour reported today" value={labourToday} sub={otToday + " OT hours"} />
        <Tile label="Active projects" value={activeProjects} sub={"of " + projects.length + " projects · " + activeEmployees + " active employees"} href="/projects" />
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <Card title="Today's dispatch" action={jobs.length > 0 && schedules[0] && (
          <Link href={"/schedules/" + schedules[0].id} className="text-xs font-medium text-[#365F91] hover:underline">Open schedule</Link>
        )}>
          {jobs.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium">No schedule for today</p>
              <p className="mt-1 text-xs text-muted-foreground">Create today&apos;s schedule to dispatch crews.</p>
              <Link href="/schedules/new" className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-primary hover:bg-accent">
                <CalendarPlus className="size-4" aria-hidden="true" /> Create schedule
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {jobs.map((job) => {
                const reportId = reportByProject.get(job.projectId);
                return (
                  <li key={job.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-[#365F91]">{job.project.jobNo || "No Job No."}</p>
                      <p className="truncate text-sm font-medium">{job.project.name || job.project.clientName || "Unnamed project"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.shift} · {timeLabel(job.timeIn)}–{timeLabel(job.timeOut)} · {job._count.foremen} foreman · {job._count.labours} labour · {job._count.equipments} equipment
                      </p>
                    </div>
                    {reportId ? (
                      <Link href={"/site-reports/" + reportId} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 sm:self-auto">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" /> Reported
                      </Link>
                    ) : (
                      <Link href={"/site-reports/new?projectId=" + encodeURIComponent(job.projectId)} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 sm:self-auto">
                        <CircleAlert className="size-3.5" aria-hidden="true" /> Submit report
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent site reports" action={<Link href="/site-reports" className="text-xs font-medium text-[#365F91] hover:underline">View all</Link>}>
          {recentReports.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">No site reports submitted yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentReports.map((report) => (
                <li key={report.id}>
                  <Link href={"/site-reports/" + report.id} className="block px-5 py-3 hover:bg-[var(--table-hover)] focus-visible:bg-[var(--table-focus)] focus-visible:outline-none">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-medium">{report.project.jobNo || report.project.name}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{report.date}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {report._count.labours} labour · {report._count.equipments} equipment{report.createdBy ? " · " + report.createdBy.name : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Tracker progress" className="xl:col-span-2" action={<Link href="/projects" className="text-xs font-medium text-[#365F91] hover:underline">Projects</Link>}>
          {trackerRows.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No trackers started yet. Open a Substation, Bus Shelter or Guardrail project to start one.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {trackerRows.map((row) => {
                const percent = Math.round((row.done / (row.items * MILESTONES_PER_ITEM)) * 100);
                return (
                  <li key={row.projectId}>
                    <Link href={"/projects/" + encodeURIComponent(row.projectId) + "#tracker"}
                      className="grid gap-2 px-5 py-3 hover:bg-[var(--table-hover)] focus-visible:bg-[var(--table-focus)] focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_minmax(160px,240px)_auto] sm:items-center sm:gap-5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{row.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {trackerTypeLabels[row.type as TrackerType] ?? row.type} · {row.items} item{row.items === 1 ? "" : "s"} · {row.approved} WIR approved
                        </span>
                      </span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={row.label + " progress"}>
                        <span className="block h-full rounded-full bg-[#365F91]" style={{ width: percent + "%" }} />
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground sm:w-12 sm:text-right">{percent}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
