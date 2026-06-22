import { MAX_PAGE_LIMIT, DEFAULT_PAGE_LIMIT } from './constants.js';

export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ListQuery {
  limit: number;
  cursor: CursorPayload | null;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  includeDeleted: boolean;
}

export interface CursorPayload {
  createdAt: string;
  id: string;
}

export function parseLimit(value: string | undefined): number {
  if (!value) return DEFAULT_PAGE_LIMIT;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_PAGE_LIMIT;
  return Math.min(parsed, MAX_PAGE_LIMIT);
}

export function parseSort(
  value: string | undefined,
  allowedFields: string[],
  defaultField = 'created_at',
): { sortField: string; sortDirection: 'asc' | 'desc' } {
  if (!value) {
    return { sortField: defaultField, sortDirection: 'desc' };
  }

  const [field, direction] = value.split(':');
  const sortField = allowedFields.includes(field ?? '') ? (field as string) : defaultField;
  const sortDirection = direction === 'asc' ? 'asc' : 'desc';
  return { sortField, sortDirection };
}

export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(value: string | undefined): CursorPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as CursorPayload;
    if (!parsed.createdAt || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseListQuery(
  searchParams: URLSearchParams,
  allowedSortFields: string[],
): ListQuery {
  const limit = parseLimit(searchParams.get('limit') ?? undefined);
  const cursor = decodeCursor(searchParams.get('cursor') ?? undefined);
  const { sortField, sortDirection } = parseSort(
    searchParams.get('sort') ?? undefined,
    allowedSortFields,
  );
  const includeDeleted = searchParams.get('include_deleted') === 'true';

  return { limit, cursor, sortField, sortDirection, includeDeleted };
}

export function buildPaginatedResponse<T extends { id: string; createdAt: Date | string }>(
  rows: T[],
  limit: number,
): PaginatedResponse<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data[data.length - 1];

  return {
    data,
    pagination: {
      limit,
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              id: last.id,
              createdAt:
                last.createdAt instanceof Date
                  ? last.createdAt.toISOString()
                  : String(last.createdAt),
            })
          : null,
    },
  };
}
