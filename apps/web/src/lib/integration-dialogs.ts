export function confirmIntegrationDisconnect(name: string): boolean {
  return window.confirm(
    `Disconnect ${name}?\n\nHistorical synced data is retained in Beacon, but new updates will stop until you reconnect.`,
  );
}

export function confirmCoreCrmReconnect(crmName: string): boolean {
  return window.confirm(
    `Reconnecting a different ${crmName} account may break existing field mappings and project links. Continue?`,
  );
}

/** @deprecated Use confirmCoreCrmReconnect('Salesforce') */
export function confirmSalesforceReconnect(): boolean {
  return confirmCoreCrmReconnect('Salesforce');
}

export function coreCrmOrgChangeWarning(crmName: string): string {
  return `A different ${crmName} account was connected. Review field mappings and project links — existing mappings may no longer apply.`;
}

/** @deprecated Use coreCrmOrgChangeWarning('Salesforce') */
export const SALESFORCE_ORG_CHANGE_WARNING = coreCrmOrgChangeWarning('Salesforce');

export const CORE_CRM_CONNECTED_LABELS: Record<string, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  microsoft_dynamics: 'Dynamics 365',
  pipedrive: 'Pipedrive',
};
