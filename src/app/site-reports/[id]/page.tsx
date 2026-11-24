import { SiteReportEditor } from "@/components/site-report-editor";

type Props = { params: Promise<{ id: string }> };
export default async function SiteReportDetailPage({ params }: Props) {
  const { id } = await params;
  return <SiteReportEditor reportId={id} />;
}
