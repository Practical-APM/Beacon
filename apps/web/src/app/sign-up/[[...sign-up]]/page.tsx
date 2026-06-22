'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignUp } from '@clerk/nextjs';
import { SkipLink } from '@/components/skip-link';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();
  const { externalAuthId, loading, authDevMode } = useAppSession();

  useEffect(() => {
    if (authDevMode) {
      router.replace('/sign-in');
      return;
    }
    if (!loading && externalAuthId) {
      router.replace('/dashboard');
    }
  }, [authDevMode, externalAuthId, loading, router]);

  if (authDevMode) {
    return null;
  }

  return (
    <main className="min-h-screen bg-background">
      <SkipLink targetId="sign-up-form" />
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
            <Image
              src="/marketing/logo-mark.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
              aria-hidden
            />
            Beacon
          </Link>
          <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
            Already have an account? Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col justify-center px-5 py-12 sm:px-6">
        <section id="sign-up-form">
          <h1 className="text-3xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Start monitoring implementation risk across your customer portfolio.
          </p>
          <div className="mt-8">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              forceRedirectUrl="/dashboard"
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
