import { describe, expect, it } from 'vitest';
import {
  buildPaginatedResponse,
  decodeCursor,
  encodeCursor,
  parseLimit,
  parseListQuery,
  parseSort,
} from './api.js';

describe('api pagination helpers', () => {
  it('caps limit at 100', () => {
    expect(parseLimit('500')).toBe(100);
    expect(parseLimit(undefined)).toBe(20);
  });

  it('encodes and decodes cursors', () => {
    const cursor = encodeCursor({ id: 'abc', createdAt: '2026-01-01T00:00:00.000Z' });
    expect(decodeCursor(cursor)).toEqual({
      id: 'abc',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('parses list query params', () => {
    const params = new URLSearchParams('limit=10&sort=name:asc&include_deleted=true');
    const query = parseListQuery(params, ['created_at', 'name']);
    expect(query.limit).toBe(10);
    expect(query.sortField).toBe('name');
    expect(query.sortDirection).toBe('asc');
    expect(query.includeDeleted).toBe(true);
  });

  it('builds paginated response with next cursor', () => {
    const rows = [
      { id: '1', createdAt: new Date('2026-01-02T00:00:00.000Z') },
      { id: '2', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: '3', createdAt: new Date('2025-12-31T00:00:00.000Z') },
    ];
    const result = buildPaginatedResponse(rows, 2);
    expect(result.data).toHaveLength(2);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toBeTruthy();
  });

  it('falls back to default sort field', () => {
    expect(parseSort(undefined, ['created_at'], 'created_at')).toEqual({
      sortField: 'created_at',
      sortDirection: 'desc',
    });
  });
});
