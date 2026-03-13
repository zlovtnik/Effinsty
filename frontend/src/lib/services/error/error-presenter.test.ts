import { describe, expect, it } from 'vitest';
import { RequestError } from '$lib/api/errors';
import {
  presentError,
  presentSessionContextError,
} from '$lib/services/error/error-presenter';

describe('error presenter', () => {
  it('preserves request error details and correlation ids', () => {
    expect(
      presentError(
        new RequestError({
          kind: 'validation',
          status: 400,
          code: 'invalid_contact',
          message: 'Contact is invalid.',
          details: ['Email is required.'],
          correlationId: 'corr-create',
        })
      )
    ).toEqual({
      kind: 'validation',
      message: 'Contact is invalid.',
      details: ['Email is required.'],
      correlationId: 'corr-create',
    });
  });

  it('falls back to a supplied message for unknown failures', () => {
    expect(presentError(null, { fallbackMessage: 'Unable to load.' })).toEqual({
      kind: 'unexpected',
      message: 'Unable to load.',
      details: [],
      correlationId: '',
    });
  });

  it('returns the shared session context presentation', () => {
    expect(presentSessionContextError()).toEqual({
      kind: 'unexpected',
      message: 'Session context is missing. Please sign in again.',
      details: [],
      correlationId: '',
    });
  });
});
