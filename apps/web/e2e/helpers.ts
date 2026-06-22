const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const WEB_ORIGIN = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export async function isApiReady(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Dev auth sign-in calls the API from the browser; CORS must match the web origin. */
export function isDevAuthE2EReady(): boolean {
  return WEB_ORIGIN === 'http://localhost:3000';
}
