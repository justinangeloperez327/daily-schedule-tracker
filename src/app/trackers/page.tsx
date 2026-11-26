import { ProjectTracker } from "@/components/project-tracker";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ projectId?: string }> };

export default async function TrackersPage({ searchParams }: Props) {
  const { projectId } = await searchParams;
  return <ProjectTracker initialProjectId={projectId || ""} />;
}
