import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DYNAMICS_FIELD_MAPPINGS,
  validateDynamicsFieldMappings,
} from './dynamics.js';

describe('dynamics field mappings', () => {
  it('validates default mappings as complete', () => {
    const { complete, missing } = validateDynamicsFieldMappings(DEFAULT_DYNAMICS_FIELD_MAPPINGS);
    expect(complete).toBe(true);
    expect(missing).toEqual([]);
  });
});
