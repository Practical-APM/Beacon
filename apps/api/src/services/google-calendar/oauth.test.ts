import { buildDefaultGoogleCalendarMetadata } from './oauth.js';
import { describe, expect, it } from 'vitest';

describe('buildDefaultGoogleCalendarMetadata', () => {
  it('derives internal domain from the connected account email', () => {
    const metadata = buildDefaultGoogleCalendarMetadata(
      'alex@acme-corp.com',
      'Alex Rivera',
    );

    expect(metadata.internalDomains).toEqual(['acme-corp.com']);
    expect(metadata.customerDomains).toEqual([]);
  });
});
