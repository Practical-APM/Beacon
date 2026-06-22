import { AppShell } from '@/components/app-shell';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { RequireAuth } from '@/components/require-auth';
import { DashboardContent } from './dashboard-content';
import { SetupFlowGuard } from '@/components/setup/setup-flow-guard';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <AppShell>
        <SetupFlowGuard>
          <div className="space-y-6">
            <DashboardPageHeader />
            <DashboardContent />
          </div>
        </SetupFlowGuard>
      </AppShell>
    </RequireAuth>
  );
}
