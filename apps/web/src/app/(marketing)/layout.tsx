import type { Metadata } from 'next';
import { MarketingShell } from '@/components/marketing/marketing-shell';
import './marketing.css';

export const metadata: Metadata = {
  title: 'Beacon',
  description:
    'Know which customer implementations will miss go-live before they miss go-live.',
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <MarketingShell>{children}</MarketingShell>;
}
