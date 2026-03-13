import { describe, expect, it } from 'vitest';
import { toAppError, userMessageFromError, RequestError } from './errors';

describe('api error mapping', () => {
  it('maps correlation ids from the backend envelope', () => {
    expect(
      toAppError(
        401,
        {
          code: 'unauthorized',
          message: 'Invalid credentials.',
          details: ['Password expired'],
          correlationId: 'corr-401',
        },
        'fallback-corr'
      )
    ).toEqual({
      kind: 'auth',
      status: 401,
      code: 'unauthorized',
      message: 'Invalid credentials.',
      details: ['Password expired'],
      correlationId: 'corr-401',
    });
  });

  it('falls back to request correlation ids when the body omits one', () => {
    expect(
      toAppError(
        503,
        {
          code: 'unavailable',
          message: 'Try again later.',
          details: [],
        },
        'corr-fallback'
      )
    ).toMatchObject({
      kind: 'unexpected',
      correlationId: 'corr-fallback',
    });
  });

  it('returns request error messages for UI display', () => {
    const error = new RequestError({
      kind: 'network',
      code: 'network_error',
      message: 'Network request failed.',
      details: [],
      correlationId: 'corr-network',
    });

    expect(userMessageFromError(error)).toBe('Network request failed.');
  });
});
