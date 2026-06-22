import Image from 'next/image';
import Link from 'next/link';

export function MarketingLogo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900">
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
