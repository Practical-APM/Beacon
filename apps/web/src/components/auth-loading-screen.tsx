import Image from 'next/image';

export function AuthLoadingScreen({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Image
        src="/marketing/logo-mark.svg"
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 animate-pulse"
        aria-hidden
      />
      <div className="w-full max-w-xs space-y-3 animate-pulse" aria-hidden>
        <div className="mx-auto h-3 w-32 rounded bg-muted" />
        <div className="h-2 rounded bg-muted" />
        <div className="h-2 w-4/5 rounded bg-muted" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
