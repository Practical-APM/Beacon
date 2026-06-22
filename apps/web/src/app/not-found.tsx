import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        This URL does not match anything in Beacon. If you followed a link from an email or
        integration, it may have expired.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className="btn-primary">
          Go to dashboard
        </Link>
        <Link href="/docs" className="btn-secondary">
          Documentation
        </Link>
        <Link href="/" className="btn-secondary">
          Marketing home
        </Link>
      </div>
    </main>
  );
}
