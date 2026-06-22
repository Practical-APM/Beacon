import { describe, expect, it } from 'vitest';
import { detectExternalOrgChange } from './org-change.js';

describe('detectExternalOrgChange', () => {
  it('detects when a connected integration switches org ids', () => {
    const result = detectExternalOrgChange({
      previousOrgId: '00DOLD',
      nextOrgId: '00DNEW',
      wasConnected: true,
    });

    expect(result).toEqual({ changed: true, previousOrgId: '00DOLD' });
  });

  it('ignores first connect and same-org reconnects', () => {
    expect(
      detectExternalOrgChange({
        previousOrgId: null,
        nextOrgId: '00DNEW',
        wasConnected: false,
      }).changed,
    ).toBe(false);

    expect(
      detectExternalOrgChange({
        previousOrgId: '00DSAME',
        nextOrgId: '00DSAME',
        wasConnected: true,
      }).changed,
    ).toBe(false);
  });
});
