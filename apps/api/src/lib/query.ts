import { buildPaginatedResponse, parseListQuery, type ListQuery } from '@beacon/shared/api';
import { and, asc, desc, eq, isNull, lt, or, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

interface CursorColumns {
  id: PgColumn;
  createdAt: PgColumn;
}

export function activeOnly<T extends { deletedAt: PgColumn }>(
  table: T,
  includeDeleted: boolean,
): SQL | undefined {
  return includeDeleted ? undefined : isNull(table.deletedAt);
}

export function applyCursor(columns: CursorColumns, cursor: ListQuery['cursor'], direction: 'asc' | 'desc') {
  if (!cursor) return undefined;

  const createdAt = new Date(cursor.createdAt);
  if (direction === 'desc') {
    return or(
      lt(columns.createdAt, createdAt),
      and(eq(columns.createdAt, createdAt), lt(columns.id, cursor.id)),
    );
  }

  return or(
    lt(columns.createdAt, createdAt),
    and(eq(columns.createdAt, createdAt), lt(columns.id, cursor.id)),
  );
}

export function orderByCreated(columns: CursorColumns, direction: 'asc' | 'desc') {
  return direction === 'asc'
    ? [asc(columns.createdAt), asc(columns.id)]
    : [desc(columns.createdAt), desc(columns.id)];
}

export async function paginateQuery<T extends { id: string; createdAt: Date | string }>(
  rows: T[],
  limit: number,
) {
  return buildPaginatedResponse(rows, limit);
}

export function parseQueryParams(url: string, allowedSortFields: string[]): ListQuery {
  return parseListQuery(new URL(url).searchParams, allowedSortFields);
}

export function serializeRecord<T extends Record<string, unknown>>(record: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      output[key] = value.toISOString();
    } else {
      output[key] = value;
    }
  }
  return output as T;
}
