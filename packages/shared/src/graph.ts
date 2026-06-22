import type { ProjectStatus } from './constants.js';

export type GraphNodeType = 'customer' | 'project' | 'milestone' | 'task' | 'owner' | 'revenue';
export type GraphEdgeType = 'contains' | 'assigned_to' | 'blocks' | 'has_revenue' | 'maps_to';

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  fromType: GraphNodeType;
  fromId: string;
  toType: GraphNodeType;
  toId: string;
  edgeType: GraphEdgeType;
  metadata?: Record<string, unknown>;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
  cycles?: string[][];
  warnings?: string[];
}

export interface OwnerWorkloadEntry {
  canonicalKey: string;
  email: string | null;
  displayName: string | null;
  openTasks: number;
  blockedTasks: number;
  projects: string[];
  confidence: number;
}

export interface PortfolioProjectSummary {
  projectId: string;
  projectName: string;
  customerName: string;
  status: ProjectStatus;
  targetGoLiveDate: string | null;
  arrAmount: number | null;
  arrCurrency: string | null;
  ownerEmail: string | null;
  openTasks: number;
  blockedTasks: number;
  pastDueGoLive: boolean;
  unlinkedJira: boolean;
}

export const ACTIVE_PORTFOLIO_STATUSES: ProjectStatus[] = ['active'];

export const INACTIVE_PORTFOLIO_STATUSES: ProjectStatus[] = ['on_hold', 'completed', 'cancelled'];

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  return email.trim().toLowerCase();
}

export function ownerCanonicalKey(email: string | null | undefined): string | null {
  const normalized = normalizeEmail(email);
  return normalized ? `owner:${normalized}` : null;
}

export function detectCycles(
  edges: Array<{ fromId: string; toId: string }>,
  maxDepth = 50,
): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const next = adjacency.get(edge.fromId) ?? [];
    next.push(edge.toId);
    adjacency.set(edge.fromId, next);
  }

  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function dfs(node: string, depth: number) {
    if (depth > maxDepth) return;
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      if (start >= 0) cycles.push(stack.slice(start).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      dfs(next, depth + 1);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of adjacency.keys()) {
    dfs(node, 0);
  }

  return cycles;
}

export function buildDirectedEdgeKey(fromId: string, toId: string): string {
  return `${fromId}:${toId}`;
}

export function findCyclicDirectedEdgeKeys(
  edges: Array<{ fromId: string; toId: string }>,
): Set<string> {
  const keys = new Set<string>();
  for (const cycle of detectCycles(edges)) {
    for (let index = 0; index < cycle.length - 1; index += 1) {
      keys.add(buildDirectedEdgeKey(cycle[index]!, cycle[index + 1]!));
    }
  }
  return keys;
}

export function excludeCyclicEdges<T extends { fromId: string; toId: string }>(
  edges: T[],
): { edges: T[]; cycleCount: number } {
  const cyclicKeys = findCyclicDirectedEdgeKeys(edges);
  if (cyclicKeys.size === 0) {
    return { edges, cycleCount: 0 };
  }
  return {
    edges: edges.filter((edge) => !cyclicKeys.has(buildDirectedEdgeKey(edge.fromId, edge.toId))),
    cycleCount: cyclicKeys.size,
  };
}

export function isPastDueGoLive(
  targetGoLiveDate: string | Date | null | undefined,
  status: ProjectStatus,
  now = new Date(),
): boolean {
  if (status !== 'active' || !targetGoLiveDate) return false;
  const date = targetGoLiveDate instanceof Date ? targetGoLiveDate : new Date(targetGoLiveDate);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

export function shouldExcludeFromActivePortfolio(status: ProjectStatus): boolean {
  return (INACTIVE_PORTFOLIO_STATUSES as readonly string[]).includes(status);
}

export function fuzzyEmailSuggestion(
  email: string,
  candidates: string[],
): { email: string; score: number } | null {
  const target = normalizeEmail(email);
  if (!target) return null;
  const targetLocal = target.split('@')[0] ?? target;
  let best: { email: string; score: number } | null = null;

  for (const candidate of candidates) {
    const normalized = normalizeEmail(candidate);
    if (!normalized || normalized === target) continue;
    const local = normalized.split('@')[0] ?? normalized;
    let score = 0;
    if (local === targetLocal) score = 80;
    else if (local.includes(targetLocal) || targetLocal.includes(local)) score = 50;
    if (!best || score > best.score) best = { email: normalized, score };
  }

  return best && best.score >= 50 ? best : null;
}
