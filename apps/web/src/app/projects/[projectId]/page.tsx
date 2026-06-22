import { AppShell } from '@/components/app-shell';
import { RequireAuth } from '@/components/require-auth';
import { ProjectDetailContent } from './project-detail-content';

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <RequireAuth>
      <AppShell>
        <ProjectDetailContent projectId={projectId} />
      </AppShell>
    </RequireAuth>
  );
}
