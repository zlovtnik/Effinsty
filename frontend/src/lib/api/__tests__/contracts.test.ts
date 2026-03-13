import { describe, expect, it } from 'vitest';
import type { AuthTokens } from '$lib/api/auth';
import type { ContactResponse, PagedResponse } from '$lib/api/contacts';
import type { ApiErrorResponse } from '$lib/api/errors';

describe('frontend contract lock fixtures', () => {
  it('locks login response shape and key casing', () => {
    const fixture: AuthTokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-03-12T12:00:00Z',
    };

    expect(Object.keys(fixture).sort()).toEqual(['accessToken', 'expiresAt', 'refreshToken']);
    expect('AccessToken' in fixture).toBe(false);
    expect('RefreshToken' in fixture).toBe(false);
    expect('ExpiresAt' in fixture).toBe(false);
  });

  it('locks paged contacts response shape and key casing', () => {
    const contact: ContactResponse = {
      id: 'a0b4a4f2-f0d2-43be-b8f3-57f076dc7dcb',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: null,
      address: null,
      metadata: {},
      createdAt: '2026-03-12T12:00:00Z',
      updatedAt: '2026-03-12T12:00:00Z',
    };

    const fixture: PagedResponse<ContactResponse> = {
      items: [contact],
      page: 1,
      pageSize: 20,
      totalCount: 1,
    };

    expect(Object.keys(fixture).sort()).toEqual(['items', 'page', 'pageSize', 'totalCount']);
    expect('PageSize' in fixture).toBe(false);
  });

  it('locks error envelope keys including correlationId', () => {
    const fixture: ApiErrorResponse = {
      code: 'validation_error',
      message: 'Request validation failed.',
      details: ['Tenant context is missing.'],
      correlationId: 'corr-test-123',
    };

    expect(Object.keys(fixture).sort()).toEqual(['code', 'correlationId', 'details', 'message']);
    expect(fixture.correlationId).toBeTruthy();
    expect('CorrelationId' in fixture).toBe(false);
  });
});
