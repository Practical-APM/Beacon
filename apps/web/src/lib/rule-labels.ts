export const RULE_LABELS: Record<string, string> = {
  project_inactivity: 'Project Inactivity',
  critical_dependency_overdue: 'Critical Dependencies',
  no_assigned_owner: 'Ownership Gaps',
  customer_response_delay: 'Customer Response',
  milestone_behind_schedule: 'Milestone Slippage',
  past_due_go_live: 'Past Due Go-Live',
};

export function getRuleLabel(ruleKey: string | null | undefined): string {
  if (!ruleKey) return 'Other Risks';
  return RULE_LABELS[ruleKey] ?? ruleKey.replace(/_/g, ' ');
}

export function groupRisksByCategory<T extends { ruleKey?: string | null }>(
  risks: T[],
): Array<{ category: string; risks: T[] }> {
  const groups = new Map<string, T[]>();
  for (const risk of risks) {
    const category = getRuleLabel(risk.ruleKey);
    const existing = groups.get(category) ?? [];
    existing.push(risk);
    groups.set(category, existing);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, risks: items }));
}
