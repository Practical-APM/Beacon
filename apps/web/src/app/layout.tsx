import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { APP_NAME } from '@beacon/shared/constants';
import { AppSessionProvider } from '@/components/providers/app-session-provider';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    'Know which customer implementations will miss go-live before they miss go-live.',
};

const authDevMode = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <ThemeProvider>
      <AppSessionProvider authDevMode={authDevMode}>
        <I18nProvider>{children}</I18nProvider>
      </AppSessionProvider>
    </ThemeProvider>
  );

  if (authDevMode) {
    return (
      <html lang="en" className={sans.variable}>
        <body className="font-sans">{body}</body>
      </html>
    );
  }

  return (
    <html lang="en" className={sans.variable}>
      <body className="font-sans">
        <ClerkProvider
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/select-org"
          afterSignUpUrl="/select-org"
        >
          {body}
        </ClerkProvider>
      </body>
    </html>
  );
}
