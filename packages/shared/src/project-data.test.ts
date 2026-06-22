import { describe, expect, it } from 'vitest';
import { isProjectCrmDataComplete } from './project-data.js';

describe('isProjectCrmDataComplete', () => {
  it('requires both go-live date and ARR', () => {
    expect(
      isProjectCrmDataComplete({
        goLiveDate: new Date('2026-09-01'),
        arrAmount: 50000,
      }),
    ).toBe(true);

    expect(
      isProjectCrmDataComplete({
        goLiveDate: new Date('2026-09-01'),
        arrAmount: null,
      }),
    ).toBe(false);

    expect(
      isProjectCrmDataComplete({
        goLiveDate: null,
        arrAmount: 50000,
      }),
    ).toBe(false);
  });
});
