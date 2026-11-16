import { ScheduleEditor } from "@/components/schedule-editor";

type Props = { params: Promise<{ id: string }> };
export default async function ScheduleDetailPage({ params }: Props) {
  const { id } = await params;
  return <ScheduleEditor sheetId={id} />;
}
