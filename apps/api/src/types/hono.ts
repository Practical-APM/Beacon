import type { AuthContext } from '@beacon/shared/auth';
import type { Context } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
    tenantId: string | null;
    userId: string | null;
    auth: AuthContext | null;
  }
}

export type AppContext = Context;
