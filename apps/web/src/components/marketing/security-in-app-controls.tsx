'use client';

import Link from 'next/link';
import { ScreenshotFrame } from '@/components/marketing/screenshot-frame';
import { MARKETING_SCREENSHOTS } from '@/lib/marketing-screenshots';

export function SecurityInAppControls() {
  return (
    <div className="mb-10 rounded-2xl border border-slate-200 bg-slate-50/50 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-slate-900">Controls you can verify in the product</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
        Security is not just a marketing page — tenant isolation, role-based access, and privacy tools
        are implemented in the app today.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <ScreenshotFrame
            compact
            src={MARKETING_SCREENSHOTS.integrations}
            alt="Connections page showing organization-scoped OAuth integrations"
            title="Tenant-scoped connections"
          />
          <p className="mt-3 text-sm text-slate-600">
            Integration credentials are isolated per organization.{' '}
            <Link href="/integrations" className="font-medium text-teal-700 hover:text-teal-800">
              Open connections
            </Link>
          </p>
        </div>
        <div>
          <ScreenshotFrame
            compact
            src={MARKETING_SCREENSHOTS.dashboard}
            alt="Portfolio dashboard with role-scoped project visibility"
            title="Role-scoped portfolio"
          />
          <p className="mt-3 text-sm text-slate-600">
            Contributors see portfolio and project risk read-only; admins manage setup.{' '}
            <Link href="/docs#settings" className="font-medium text-teal-700 hover:text-teal-800">
              Settings reference
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
