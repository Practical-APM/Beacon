export function findOverlappingDomains(
  internalDomains: string[],
  customerDomains: string[],
): string[] {
  const internal = new Set(internalDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean));
  return customerDomains
    .map((domain) => domain.trim().toLowerCase())
    .filter((domain) => domain && internal.has(domain));
}

export function hasUnresolvedDomainCollision(
  internalDomains: string[],
  customerDomains: string[],
  domainOverrides: string[] = [],
): boolean {
  const overlapping = findOverlappingDomains(internalDomains, customerDomains);
  if (overlapping.length === 0) return false;
  const overrideSet = new Set(domainOverrides.map((domain) => domain.trim().toLowerCase()).filter(Boolean));
  return overlapping.some((domain) => !overrideSet.has(domain));
}

export interface DomainCollisionWarning {
  overlappingDomains: string[];
  message: string;
}

export function buildDomainCollisionWarning(
  internalDomains: string[],
  customerDomains: string[],
  mappingDomainOverrides: string[][] = [],
): DomainCollisionWarning | null {
  const allOverrides = mappingDomainOverrides.flat();
  if (!hasUnresolvedDomainCollision(internalDomains, customerDomains, allOverrides)) {
    return null;
  }

  const overlapping = findOverlappingDomains(internalDomains, customerDomains);
  return {
    overlappingDomains: overlapping,
    message:
      overlapping.length === 1
        ? `Domain "${overlapping[0]}" is listed as both internal and customer. Add it as a customer-domain override on affected channel or calendar mappings so participant classification stays accurate.`
        : `Domains ${overlapping.map((domain) => `"${domain}"`).join(', ')} are listed as both internal and customer. Add customer-domain overrides on affected mappings.`,
  };
}

export function parseDomainOverrideInput(input: string): string[] {
  return input
    .split(/[,\s]+/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}
