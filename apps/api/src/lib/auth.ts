import type { AuthContext } from '@beacon/shared/auth';
import { env } from '../env.js';
import { unauthorized } from './errors.js';

const DEV_TOKEN_PREFIX = 'dev:';

export interface VerifiedIdentity {
  externalAuthId: string;
  email: string;
  name: string | null;
}

export async function verifyAccessToken(token: string): Promise<VerifiedIdentity> {
  if (token.startsWith(DEV_TOKEN_PREFIX)) {
    if (env.NODE_ENV === 'production' || env.NODE_ENV === 'staging') {
      throw unauthorized();
    }
    if (!env.AUTH_DEV_MODE) {
      throw unauthorized();
    }
    const externalAuthId = token.slice(DEV_TOKEN_PREFIX.length);
    if (!externalAuthId) {
      throw unauthorized();
    }
    return {
      externalAuthId,
      email: `${externalAuthId}@dev.beacon.test`,
      name: externalAuthId,
    };
  }

  if (!env.CLERK_SECRET_KEY) {
    throw unauthorized();
  }

  const { verifyToken } = await import('@clerk/backend');
  const payload = await verifyToken(token, {
    secretKey: env.CLERK_SECRET_KEY,
  });

  const externalAuthId = payload.sub;
  const email =
    typeof payload.email === 'string'
      ? payload.email
      : (payload.primary_email_address as string | undefined);

  if (!externalAuthId || !email) {
    throw unauthorized();
  }

  const name =
    typeof payload.name === 'string'
      ? payload.name
      : typeof payload.first_name === 'string'
        ? payload.first_name
        : null;

  return { externalAuthId, email, name };
}

export function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim() || null;
}

export function toAuthContext(
  identity: VerifiedIdentity,
  membership: {
    userId: string;
    tenantId: string;
    role: AuthContext['role'];
  },
): AuthContext {
  return {
    userId: membership.userId,
    externalAuthId: identity.externalAuthId,
    email: identity.email,
    name: identity.name,
    tenantId: membership.tenantId,
    role: membership.role,
  };
}
