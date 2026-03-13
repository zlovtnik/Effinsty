import { describe, expect, it } from 'vitest';
import {
  createNetworkError,
  mapApiError,
} from '$lib/services/error/error-mapper';

describe('error mapper', () => {
  it('maps backend envelopes into typed app errors', () => {
    expect(
      mapApiError(
        401,
        {
          code: 'unauthorized',
          message: 'Invalid credentials.',
          details: ['Password expired.'],
          correlationId: 'corr-auth',
        },
        'corr-fallback'
      )
    ).toEqual({
      kind: 'auth',
      status: 401,
      code: 'unauthorized',
      message: 'Invalid credentials.',
      details: ['Password expired.'],
      correlationId: 'corr-auth',
    });
  });

  it('falls back to a default envelope when the body is not an object', () => {
    expect(mapApiError(503, null, 'corr-fallback')).toMatchObject({
      kind: 'unexpected',
      code: 'unexpected_error',
      correlationId: 'corr-fallback',
    });
  });

  it('creates network errors with an optional correlation id', () => {
    expect(createNetworkError('Offline.', 'corr-network')).toEqual({
      kind: 'network',
      code: 'network_error',
      message: 'Offline.',
      details: [],
      correlationId: 'corr-network',
    });
  });
});
