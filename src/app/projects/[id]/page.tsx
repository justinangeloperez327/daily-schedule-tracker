import Link from "next/link";
import { ArrowLeft, ClipboardList, ClipboardPlus, FileText, Info } from "lucide-react";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { trackerTypeForProject, trackerTypeLabels } from "@/lib/project-tracker";
import { ProjectTrackerPanel } from "@/components/project-tracker-panel";
import { dateLabel } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

const MILESTONES_PER_ITEM = 5;

function statusTone(status: string) {
  const value = status.trim().toLowerCase();
  if (/complete|closed|done|handed/.test(value)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (/hold|suspend|delay/.test(value)) return "border-amber-200 bg-amber-50 text-amber-800";
  if (/cancel/.test(value)) return "border-red-200 bg-red-50 text-red-700";
  if (/ongoing|progress|active|open/.test(value)) return "border-[#BFD5EE] bg-[#EAF2FC] text-[#254C77]";
  return "border-border bg-muted text-muted-foreground";
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-white px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1.5 min-w-0 text-sm">{children}</div>
    </div>
  );
}

export default async function ProjectDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const prisma = getPrisma();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) notFound();

  const [trackerItems, reportCount, recentReports] = await Promise.all([
    prisma.projectTrackerItem.findMany({
      where: { projectId: id },
      select: {
        siteMeasurementDate: true, drawingToProductionDate: true, deliveryDate: true,
        installationDate: true, wirStatus: true,
      },
    }),
    prisma.siteDailyReport.count({ where: { projectId: id } }),
    prisma.siteDailyReport.findMany({
      where: { projectId: id },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 5,
      select: { id: true, date: true, labours: { select: { otHours: true } }, _count: { select: { equipments: true } } },
    }),
  ]);

  const trackerType = trackerTypeForProject(project);
  // Same rule as trackerProgress(): four dated stages plus an approved WIR.
  const milestonesDone = trackerItems.reduce((sum, item) =>
    sum + [item.siteMeasurementDate, item.drawingToProductionDate, item.deliveryDate, item.installationDate]
      .filter(Boolean).length + (item.wirStatus === "Approved" ? 1 : 0), 0);
  const milestonesTotal = trackerItems.length * MILESTONES_PER_ITEM;
  const percent = milestonesTotal ? Math.round((milestonesDone / milestonesTotal) * 100) : 0;
  const newReportHref = "/site-reports/new?projectId=" + encodeURIComponent(project.id);

  return (
    <main className="w-full min-w-0 px-3 pb-16 pt-6 sm:px-6 lg:px-8 2xl:px-10">
      <Link href="/projects" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
        <ArrowLeft className="size-4" aria-hidden="true" /> Projects
      </Link>

      {/* Header */}
      <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-4xl">
          <p className="technical-eyebrow mb-2">
            PROJECT{project.subCategory ? " / " + project.subCategory : ""}
          </p>
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-[-0.03em] text-primary sm:text-[28px] [overflow-wrap:anywhere]">
            {project.name || "Unnamed project"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{project.clientName || "Client not specified"}</span>
            {project.status && (
              <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", statusTone(project.status))}>
                {project.status}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
            <span className="rounded-md border border-border bg-white px-2 py-1 text-[#365F91]">
              <span className="text-muted-foreground">JOB </span>{project.jobNo || "—"}
            </span>
            <span className="rounded-md border border-border bg-white px-2 py-1 text-[#365F91]">
              <span className="text-muted-foreground">SO </span>{project.soNo || "—"}
            </span>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:shrink-0">
          <Link href={newReportHref}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30">
            <ClipboardPlus className="size-4" aria-hidden="true" /> New site report
          </Link>
        </div>
      </header>

      {/* Summary */}
      <section aria-label="Project summary" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Project in charge">
          <p className="truncate font-medium">{project.projectInCharge || "—"}</p>
        </StatTile>
        <StatTile label="Category">
          <p className="truncate font-medium">{project.mainCategory || "—"}</p>
          <p className="truncate text-xs text-muted-foreground">{project.subCategory || "No sub category"}</p>
        </StatTile>
        <StatTile label={trackerType ? trackerTypeLabels[trackerType] + " tracker" : "Tracker"}>
          {trackerType && trackerItems.length > 0 ? (
            <>
              <p className="font-medium tabular-nums">{percent}%
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                  {milestonesDone}/{milestonesTotal} milestones
                </span>
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar"
                aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Tracker progress">
                <div className="h-full rounded-full bg-[#365F91]" style={{ width: percent + "%" }} />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{trackerType ? "Not started" : "No template"}</p>
          )}
        </StatTile>
        <StatTile label="Site daily reports">
          <p className="font-medium tabular-nums">{reportCount}</p>
          <p className="truncate text-xs text-muted-foreground">
            {recentReports[0] ? "Last: " + dateLabel(recentReports[0].date) : "None submitted yet"}
          </p>
        </StatTile>
      </section>

      {/* Overview + recent reports */}
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-white">
          <h2 className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold text-primary">
            <FileText className="size-4 text-[#365F91]" aria-hidden="true" /> Description
          </h2>
          <div className="px-5 py-5">
            <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">
              {project.descriptions?.trim() || <span className="text-muted-foreground">No description recorded.</span>}
            </p>
          </div>
          <p className="flex items-start gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Revision, payment terms and contract value are temporarily hidden. Their stored data is unchanged.
          </p>
        </section>

        <section className="min-w-0 rounded-xl border border-border bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h2 className="text-sm font-semibold text-primary">Recent site reports</h2>
            {reportCount > 0 && (
              <Link href={newReportHref} className="text-xs font-medium text-[#365F91] hover:underline">Add report</Link>
            )}
          </div>
          {recentReports.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium">No site reports yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Daily labour and equipment for this job appear here.</p>
              <Link href={newReportHref}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-input bg-white px-3 text-sm font-medium text-primary hover:bg-accent">
                <ClipboardPlus className="size-4" aria-hidden="true" /> New site report
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentReports.map((report) => {
                const ot = report.labours.reduce((sum, labour) => sum + Number(labour.otHours), 0);
                return (
                  <li key={report.id}>
                    <Link href={"/site-reports/" + report.id}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--table-hover)] focus-visible:bg-[var(--table-focus)] focus-visible:outline-none">
                      <span className="min-w-0 truncate text-sm font-medium">{dateLabel(report.date)}</span>
                      <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                        {report.labours.length} lab · {ot} OT · {report._count.equipments} eq
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {reportCount > recentReports.length && (
            <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
              Showing the latest {recentReports.length} of {reportCount}. <Link href="/site-reports" className="text-[#365F91] hover:underline">All site reports</Link>
            </p>
          )}
        </section>
      </div>

      {/* Tracker */}
      <section id="tracker" className="mt-10 min-w-0 scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="technical-eyebrow mb-1">PROJECT TRACKER</p>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-primary">
              <ClipboardList className="size-5 text-[#365F91]" aria-hidden="true" />
              {trackerType ? trackerTypeLabels[trackerType] + " Tracker" : "Tracker"}
            </h2>
          </div>
        </div>
        {trackerType ? (
          <ProjectTrackerPanel key={project.id} projectId={project.id} trackerType={trackerType} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-muted-foreground">
            No tracker template for the sub category &ldquo;{project.subCategory || project.mainCategory || "not set"}&rdquo;.
            Trackers exist for Substation, Bus Shelters and Guardrail projects.
          </div>
        )}
      </section>
    </main>
  );
}
