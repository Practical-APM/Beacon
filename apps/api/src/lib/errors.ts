import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly title: string,
    public readonly detail?: string,
    public readonly type = 'about:blank',
  ) {
    super(detail ?? title);
    this.name = 'ApiError';
  }
}

export function problemResponse(c: Context, error: ApiError) {
  const requestId = c.get('requestId') as string | undefined;
  return c.json(
    {
      type: error.type,
      title: error.title,
      status: error.status,
      detail: error.detail,
      requestId,
    },
    error.status,
  );
}

export const unauthorized = () => new ApiError(401, 'Unauthorized', 'Authentication required');
export const forbidden = (detail?: string) =>
  new ApiError(403, 'Forbidden', detail ?? 'You do not have access to this resource');
export const notFound = (detail?: string) =>
  new ApiError(404, 'Not Found', detail ?? 'Resource not found');
export const badRequest = (detail: string) => new ApiError(400, 'Bad Request', detail);
export const conflict = (detail: string) => new ApiError(409, 'Conflict', detail);
