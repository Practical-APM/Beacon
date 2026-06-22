const DEV_TOKEN_PREFIX = 'dev:';

/** Build the Authorization header value for API requests. */
export async function buildAuthorizationHeader(
  authDevMode: boolean,
  externalAuthId: string,
  getClerkToken: () => Promise<string | null>,
): Promise<string> {
  if (authDevMode) {
    return `Bearer ${DEV_TOKEN_PREFIX}${externalAuthId}`;
  }

  const token = await getClerkToken();
  if (!token) {
    throw new Error('Missing Clerk session token');
  }
  return `Bearer ${token}`;
}

export async function buildApiHeaders(
  params: {
    authDevMode: boolean;
    externalAuthId: string;
    activeTenantId?: string | null;
    getClerkToken: () => Promise<string | null>;
    extra?: Record<string, string>;
  },
): Promise<Record<string, string>> {
  const authorization = await buildAuthorizationHeader(
    params.authDevMode,
    params.externalAuthId,
    params.getClerkToken,
  );

  const headers: Record<string, string> = {
    Authorization: authorization,
    'Content-Type': 'application/json',
    ...params.extra,
  };

  if (params.activeTenantId) {
    headers['x-tenant-id'] = params.activeTenantId;
  }

  return headers;
}
