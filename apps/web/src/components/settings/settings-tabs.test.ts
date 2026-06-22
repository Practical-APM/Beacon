import { describe, expect, it } from 'vitest';
import { resolveSettingsTab } from './settings-tabs';

describe('resolveSettingsTab', () => {
  it('defaults to preferences for unknown tabs', () => {
    expect(resolveSettingsTab(null, false)).toBe('preferences');
    expect(resolveSettingsTab('unknown', true)).toBe('preferences');
  });

  it('allows admin tab only for admins', () => {
    expect(resolveSettingsTab('admin', true)).toBe('admin');
    expect(resolveSettingsTab('admin', false)).toBe('preferences');
  });

  it('supports account, notifications, and privacy tabs', () => {
    expect(resolveSettingsTab('account', false)).toBe('account');
    expect(resolveSettingsTab('notifications', false)).toBe('notifications');
    expect(resolveSettingsTab('privacy', false)).toBe('privacy');
  });
});
