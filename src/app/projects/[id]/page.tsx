import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, FileText, Layers3, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function DetailField({ label, value, mono = false }: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 border-b border-border/80 py-4 last:border-0">
      <dt className="technical-eyebrow mb-1.5">{label}</dt>
      <dd className={(mono ? "font-mono text-[#365F91]" : "text-foreground") +
        " whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]"}>
        {value?.trim() || <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}

export default async function ProjectDetailsPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getPrisma().project.findUnique({ where: { id } });
  if (!project) notFound();

  return (
    <main className="min-h-[calc(100vh-64px)] w-full min-w-0 bg-background px-3 pb-12 pt-6 sm:px-6 lg:px-8 2xl:px-10 lg:pt-12">
      <Link href="/projects" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
        <ArrowLeft className="size-4" /> Back to Projects
      </Link>

      <div className="mb-6">
        <p className="technical-eyebrow mb-2">MASTER DATA / PROJECTS / DETAIL</p>
        <h1 className="max-w-5xl whitespace-pre-wrap break-words text-[28px] font-semibold tracking-[-0.035em] text-primary sm:text-[32px] [overflow-wrap:anywhere]">
          {project.name || "Unnamed project"}
        </h1>
        <p className="mt-2 font-mono text-xs text-[#365F91]">
          JOB NO: {project.jobNo || "—"} <span className="mx-2 text-muted-foreground">/</span> SO NO: {project.soNo || "—"}
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(290px,1fr)]">
        <section className="min-w-0 rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <FileText className="size-4 text-[#365F91]" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-primary">Project information</h2>
          </div>
          <dl className="px-5">
            <DetailField label="Project Name" value={project.name} />
            <DetailField label="Description" value={project.descriptions} />
            <DetailField label="Client Name" value={project.clientName} />
            <div className="grid gap-x-6 sm:grid-cols-2">
              <DetailField label="SO No" value={project.soNo} mono />
              <DetailField label="Job No" value={project.jobNo} mono />
            </div>
          </dl>
        </section>

        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <Layers3 className="size-4 text-[#365F91]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-primary">Classification</h2>
            </div>
            <dl className="px-5">
              <DetailField label="Main Category" value={project.mainCategory} />
              <DetailField label="Sub Category" value={project.subCategory} />
              <DetailField label="Status" value={project.status} />
            </dl>
          </section>
          <section className="rounded-xl border border-border bg-white shadow-[0_2px_16px_rgba(16,24,40,0.025)]">
            <div className="flex items-center gap-2 border-b border-border px-5 py-4">
              <UserRound className="size-4 text-[#365F91]" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-primary">Responsibility</h2>
            </div>
            <dl className="px-5">
              <DetailField label="Project In Charge" value={project.projectInCharge} />
            </dl>
          </section>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-3 text-xs text-muted-foreground">
            <BriefcaseBusiness aria-hidden="true" className="size-4 shrink-0 text-[#365F91]" />
            <p>Revision, Payment Terms and Contract Value are temporarily hidden in the directory and detail view. Their stored data is unchanged.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
