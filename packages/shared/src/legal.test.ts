import { DPA_DOCUMENT, DPA_VERSION, isDpaAcceptanceCurrent } from './legal.js';
import { describe, expect, it } from 'vitest';

describe('legal', () => {
  it('exposes DPA document metadata', () => {
    expect(DPA_DOCUMENT.version).toBe(DPA_VERSION);
    expect(DPA_DOCUMENT.sections.length).toBeGreaterThan(0);
  });

  it('validates current DPA acceptance', () => {
    expect(isDpaAcceptanceCurrent(DPA_VERSION, new Date())).toBe(true);
    expect(isDpaAcceptanceCurrent('old-version', new Date())).toBe(false);
  });
});
