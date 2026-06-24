import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { APP_NAME } from '@beacon/shared/constants';
import { AppSessionProvider } from '@/components/providers/app-session-provider';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const themeInitScript = `(function(){try{var t=localStorage.getItem('beacon.theme');var d=t==='light'?false:t==='system'?matchMedia('(prefers-color-scheme: dark)').matches:true;document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`;

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

  const fontClass = `${inter.variable} ${archivo.variable}`;

  if (authDevMode) {
    return (
      <html lang="en" className={`dark ${fontClass}`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body className="font-sans">{body}</body>
      </html>
    );
  }

  return (
    <html lang="en" className={`dark ${fontClass}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
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
