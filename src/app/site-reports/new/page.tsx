import { SiteReportEditor } from "@/components/site-report-editor";

type Props = { searchParams: Promise<{ projectId?: string }> };

// ?projectId=... pre-selects the job order (used from the project details page).
export default async function NewSiteReportPage({ searchParams }: Props) {
  const { projectId } = await searchParams;
  return <SiteReportEditor initialProjectId={projectId ?? ""} />;
}
