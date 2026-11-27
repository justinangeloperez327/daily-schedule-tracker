import { getPrisma } from "@/lib/prisma";
import { siteToday } from "@/lib/site-date";
import type { AuthUser } from "@/lib/auth";
import type { AppNotification } from "@/lib/notifications";

const NEW_REPORT_WINDOW_DAYS = 3;
const WIR_WINDOW_DAYS = 30;
const MAX_ITEMS = 30;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function jobLabel(project: { jobNo: string | null; name: string }) {
  return project.jobNo || project.name || "a job";
}

// Notifications are derived from live data, not stored:
//  - jobs dispatched today that have no site daily report yet
//  - site reports other people submitted in the last few days
//  - tracker items whose WIR was rejected or returned for revision
export async function notificationsFor(user: AuthUser): Promise<{ items: AppNotification[]; unread: number }> {
  const prisma = getPrisma();
  const today = siteToday();
  const [account, todaysJobs, todaysReports, newReports, wirIssues] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { notificationsSeenAt: true } }),
    prisma.scheduleJob.findMany({
      where: { schedule: { date: today } },
      select: { projectId: true, project: { select: { jobNo: true, name: true } }, schedule: { select: { createdAt: true } } },
    }),
    prisma.siteDailyReport.findMany({ where: { date: today }, select: { projectId: true } }),
    prisma.siteDailyReport.findMany({
      where: { createdAt: { gte: daysAgo(NEW_REPORT_WINDOW_DAYS) }, NOT: { createdById: user.id } },
      orderBy: { createdAt: "desc" },
      take: MAX_ITEMS,
      select: {
        id: true, date: true, createdAt: true,
        createdBy: { select: { name: true } },
        project: { select: { jobNo: true, name: true } },
        _count: { select: { labours: true } },
      },
    }),
    prisma.projectTrackerItem.findMany({
      where: { wirStatus: { in: ["Rejected", "Revise and resubmit"] }, updatedAt: { gte: daysAgo(WIR_WINDOW_DAYS) } },
      orderBy: { updatedAt: "desc" },
      take: MAX_ITEMS,
      select: { id: true, label: true, wirStatus: true, updatedAt: true, projectId: true, project: { select: { jobNo: true, name: true } } },
    }),
  ]);

  const seenAt = account?.notificationsSeenAt ?? new Date(0);
  const reported = new Set(todaysReports.map((report) => report.projectId));
  const items: Omit<AppNotification, "unread">[] = [];

  const missing = new Map<string, (typeof todaysJobs)[number]>();
  for (const job of todaysJobs) if (!reported.has(job.projectId)) missing.set(job.projectId, job);
  for (const job of missing.values()) {
    items.push({
      id: "missing:" + today + ":" + job.projectId,
      kind: "missing_report",
      title: "No site report yet for " + jobLabel(job.project),
      body: "Dispatched today. Submit the site daily report.",
      href: "/site-reports/new?projectId=" + encodeURIComponent(job.projectId),
      at: job.schedule.createdAt.toISOString(),
    });
  }
  for (const report of newReports) {
    items.push({
      id: "report:" + report.id,
      kind: "new_report",
      title: "Site report for " + jobLabel(report.project),
      body: (report.createdBy?.name ?? "Someone") + " · " + report.date + " · " + report._count.labours + " labour",
      href: "/site-reports/" + report.id,
      at: report.createdAt.toISOString(),
    });
  }
  for (const item of wirIssues) {
    items.push({
      id: "wir:" + item.id + ":" + item.updatedAt.getTime(),
      kind: "wir_issue",
      title: "WIR " + item.wirStatus.toLowerCase() + ": " + item.label,
      body: jobLabel(item.project),
      href: "/projects/" + encodeURIComponent(item.projectId) + "#tracker",
      at: item.updatedAt.toISOString(),
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));
  // A missing report stays unread until it is submitted, so it can't be dismissed by opening the bell.
  const result = items.slice(0, MAX_ITEMS).map((item) => ({
    ...item,
    unread: item.kind === "missing_report" || new Date(item.at) > seenAt,
  }));
  return { items: result, unread: result.filter((item) => item.unread).length };
}
