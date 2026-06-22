import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { SessionBanner } from '@/components/marketing/session-banner';
import { SkipLink } from '@/components/skip-link';

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-site min-h-screen">
      <SkipLink />
      <SessionBanner />
      <MarketingNav />
      <div id="main-content">{children}</div>
      <MarketingFooter />
    </div>
  );
}
