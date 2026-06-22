'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignIn } from '@clerk/nextjs';
import { DevSignInForm } from '@/components/dev-sign-in-form';
import { TrustBadges } from '@/components/trust-badges';
import { SkipLink } from '@/components/skip-link';
import { useAppSession } from '@/components/providers/app-session-provider';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const { externalAuthId, loading, authDevMode } = useAppSession();

  useEffect(() => {
    if (!loading && externalAuthId) {
      router.replace('/dashboard');
    }
  }, [externalAuthId, loading, router]);

  return (
    <main className="min-h-screen bg-background">
      <SkipLink targetId="sign-in-form" />
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
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to website
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-6xl lg:grid-cols-2">
        <section
          id="sign-in-form"
          className="flex flex-col justify-center px-5 py-12 sm:px-6 sm:py-16 lg:px-12"
        >
          <p className="text-sm font-medium text-primary">
            {authDevMode ? 'Prototype workspace' : 'Sign in'}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Sign in to your workspace
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
            See which customer implementations are likely to miss go-live, why they are at risk,
            and what to do next.
            {authDevMode ? ' Demo data loads in seconds.' : null}
          </p>
          <div className="mt-8 max-w-md">
            {authDevMode ? (
              <DevSignInForm />
            ) : (
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                forceRedirectUrl="/dashboard"
                fallbackRedirectUrl="/dashboard"
              />
            )}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {authDevMode ? (
              <>
                New here?{' '}
                <Link
                  href="/docs?guide=try-prototype&step=0"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Follow the 2-minute prototype guide
                </Link>{' '}
                or{' '}
              </>
            ) : (
              <>
                Need an account?{' '}
                <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
                  Sign up
                </Link>{' '}
                or{' '}
              </>
            )}
            <Link href="/" className="text-primary underline-offset-4 hover:underline">
              explore the website
            </Link>{' '}
            for pricing and security details.
          </p>
        </section>
        <section className="flex flex-col justify-center border-t border-border bg-muted/30 px-5 py-12 sm:px-6 lg:border-l lg:border-t-0 lg:px-12 lg:py-16">
          <h2 className="text-lg font-semibold">Built for implementation teams</h2>
          <ul className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
            <li>Portfolio view of revenue at risk across active go-lives</li>
            <li>Root cause explanations with evidence from Salesforce, Jira, Slack, and Calendar</li>
            <li>Predicted delay ranges with confidence intervals</li>
            <li>Peer benchmarks when your organization opts in</li>
          </ul>
          <div className="mt-10">
            <TrustBadges compact />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Open source with self-serve privacy controls in Settings. No unearned certification claims.
          </p>
        </section>
      </div>
    </main>
  );
}
