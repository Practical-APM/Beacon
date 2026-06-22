import { describe, expect, it, vi } from 'vitest';
import { runInBackground } from './background-job.js';

describe('runInBackground', () => {
  it('logs failures without rethrowing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const task = vi.fn().mockRejectedValue(new Error('sync exploded'));

    runInBackground('test-job', task, { tenantId: 'tenant-1' });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(task).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
