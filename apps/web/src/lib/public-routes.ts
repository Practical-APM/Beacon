/** Public web routes that bypass Clerk auth when keys are configured. */
export const PUBLIC_WEB_ROUTE_PATTERNS = [
  '/',
  '/docs(.*)',
  '/faq(.*)',
  '/security(.*)',
  '/pricing(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/legal(.*)',
  '/notifications/unsubscribe(.*)',
] as const;

export function isPublicWebPath(pathname: string): boolean {
  return PUBLIC_WEB_ROUTE_PATTERNS.some((pattern) => {
    if (pattern.endsWith('(.*)')) {
      const prefix = pattern.slice(0, -4);
      return pathname === prefix || pathname.startsWith(`${prefix}/`);
    }
    return pathname === pattern;
  });
}
