export const DPA_VERSION = '2026-06-01';

export const DPA_DOCUMENT = {
  version: DPA_VERSION,
  title: 'Data Processing Agreement',
  effectiveDate: '2026-06-01',
  sections: [
    {
      heading: '1. Purpose',
      body: 'This Data Processing Agreement ("DPA") governs Beacon\'s processing of personal data on behalf of the Customer when providing implementation risk intelligence services.',
    },
    {
      heading: '2. Roles',
      body: 'Customer is the data controller. Beacon acts as data processor for Customer Content and authorized user account data processed through the platform.',
    },
    {
      heading: '3. Processing scope',
      body: 'Processing is limited to delivering go-live risk detection, dashboards, notifications, and audit logs described in the Order Form. Beacon does not sell personal data or use Customer Content to train public models.',
    },
    {
      heading: '4. Security measures',
      body: 'Beacon implements encryption in transit, tenant isolation, access controls, audit logging, and incident response procedures aligned with industry standards.',
    },
    {
      heading: '5. Sub-processors',
      body: 'Customer authorizes use of infrastructure and integration sub-processors listed in the Sub-processor Schedule. Beacon will provide notice of material changes.',
    },
    {
      heading: '6. Data subject rights',
      body: 'Beacon assists Customer with data export and deletion requests through in-product privacy tools and documented support procedures.',
    },
    {
      heading: '7. Retention and deletion',
      body: 'Customer Content is retained for the subscription term. Upon termination, Beacon deletes or returns Customer Content within 30 days unless law requires longer retention.',
    },
  ],
} as const;

export function isDpaAcceptanceCurrent(
  acceptedVersion: string | null | undefined,
  acceptedAt: Date | string | null | undefined,
): boolean {
  return Boolean(acceptedAt && acceptedVersion === DPA_VERSION);
}
