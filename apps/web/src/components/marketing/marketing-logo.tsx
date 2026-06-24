import Image from 'next/image';
import Link from 'next/link';

export function MarketingLogo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-display font-semibold tracking-tight text-[var(--m-text)]">
      <Image
        src="/marketing/logo-mark.svg"
        alt=""
        width={32}
        height={32}
        className="h-8 w-8"
        aria-hidden
      />
      <span>Beacon</span>
    </Link>
  );
}
