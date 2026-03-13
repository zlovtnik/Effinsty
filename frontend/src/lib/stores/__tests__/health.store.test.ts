import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$lib/api/health', () => ({
  checkHealth: vi.fn(),
}));

import { checkHealth } from '$lib/api/health';
import { healthStore } from '../health.store';

const checkHealthMock = vi.mocked(checkHealth);

describe('healthStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    healthStore.reset();
  });

  afterEach(() => {
    healthStore.reset();
    vi.useRealTimers();
  });

  it('starts polling immediately and updates healthy state', async () => {
    checkHealthMock.mockResolvedValue({
      state: 'healthy',
      checkedAt: 123,
      message: '',
      correlationId: 'corr-health',
    });

    healthStore.startPolling(1000);
    await vi.runAllTicks();

    expect(checkHealthMock).toHaveBeenCalledTimes(1);
    expect(get(healthStore)).toEqual({
      state: 'healthy',
      checkedAt: 123,
      message: '',
      correlationId: 'corr-health',
    });

    await vi.advanceTimersByTimeAsync(1000);
    expect(checkHealthMock).toHaveBeenCalledTimes(2);
  });

  it('keeps degraded responses in store state', async () => {
    checkHealthMock.mockResolvedValue({
      state: 'degraded',
      checkedAt: 456,
      message: 'Gateway timeout',
      correlationId: 'corr-degraded',
    });

    await healthStore.checkNow();

    expect(get(healthStore)).toEqual({
      state: 'degraded',
      checkedAt: 456,
      message: 'Gateway timeout',
      correlationId: 'corr-degraded',
    });
  });
});
