// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '$lib/api/__tests__/msw/server';
import { login } from '$lib/api/auth';
import { listContacts } from '$lib/api/contacts';
import { isRequestError } from '$lib/api/errors';

describe('frontend contract locks', () => {
  it('locks login response shape and key casing via real api call', async () => {
    server.use(
      http.post('http://localhost/api/auth/login', () =>
        HttpResponse.json({
          expiresAt: '2026-03-12T12:00:00Z',
        })
      )
    );

    const response = await login('tenant-a', { username: 'alice', password: 'password' }, 'corr-login');

    expect(Object.keys(response).sort()).toEqual(['expiresAt']);
    expect('AccessToken' in response).toBe(false);
    expect('RefreshToken' in response).toBe(false);
    expect('ExpiresAt' in response).toBe(false);
  });

  it('locks paged contacts response shape and key casing via real api call', async () => {
    server.use(
      http.get('http://localhost/api/contacts', () =>
        HttpResponse.json({
          items: [
            {
              id: 'a0b4a4f2-f0d2-43be-b8f3-57f076dc7dcb',
              firstName: 'Ada',
              lastName: 'Lovelace',
              email: 'ada@example.com',
              phone: null,
              address: null,
              metadata: {},
              createdAt: '2026-03-12T12:00:00Z',
              updatedAt: '2026-03-12T12:00:00Z',
            },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
        })
      )
    );

    const response = await listContacts({
      context: {
        tenantId: 'tenant-a',
      },
      page: 1,
      pageSize: 20,
      correlationId: 'corr-contacts',
    });

    expect(Object.keys(response).sort()).toEqual(['items', 'page', 'pageSize', 'totalCount']);
    expect('PageSize' in response).toBe(false);
  });

  it('locks error envelope keys including correlationId via real api call', async () => {
    server.use(
      http.post('http://localhost/api/auth/login', () =>
        HttpResponse.json(
          {
            code: 'validation_error',
            message: 'Request validation failed.',
            details: ['Tenant context is missing.'],
            correlationId: 'corr-test-123',
          },
          { status: 400, headers: { 'X-Correlation-ID': 'corr-test-123' } }
        )
      )
    );

    try {
      await login('tenant-a', { username: 'alice', password: 'password' }, 'corr-login-error');
      throw new Error('Expected login to throw');
    } catch (error) {
      expect(isRequestError(error)).toBe(true);
      if (!isRequestError(error)) {
        return;
      }

      expect(error.appError.code).toBe('validation_error');
      expect(error.appError.correlationId).toBe('corr-test-123');
      expect(error.appError.message).toBe('Request validation failed.');
      expect(Array.isArray(error.appError.details)).toBe(true);
    }
  });
});
