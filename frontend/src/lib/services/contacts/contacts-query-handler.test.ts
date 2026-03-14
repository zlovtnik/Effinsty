import { describe, expect, it, vi } from 'vitest';
import { isRequestError } from '$lib/api/errors';
import { createContactsQueryHandler } from '$lib/services/contacts/contacts-query-handler';
import { createContactsService } from '$lib/services/contacts/contacts.service';

describe('contacts query handler', () => {
  it('delegates list queries through service paging normalization', async () => {
    const requestWithAuthMock = vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
    });

    const handler = createContactsQueryHandler({
      contactsService: createContactsService({
        requestWithAuth: requestWithAuthMock,
      }),
    });

    await handler.list({
      context: { tenantId: 'tenant-a' },
      page: 0,
      pageSize: 999,
    });

    expect(requestWithAuthMock).toHaveBeenCalledWith('/contacts?page=1&pageSize=100', {
      method: 'GET',
      tenantId: 'tenant-a',
      correlationId: undefined,
    });
  });

  it('rejects invalid get queries via the underlying service validation', async () => {
    const handler = createContactsQueryHandler({
      contactsService: createContactsService({
        requestWithAuth: vi.fn(),
      }),
    });

    try {
      await handler.get({
        context: { tenantId: 'tenant-a' },
        id: '   ',
      });
      throw new Error('Expected get to fail');
    } catch (error) {
      expect(isRequestError(error)).toBe(true);
      if (!isRequestError(error)) {
        return;
      }

      expect(error.appError.message).toContain('Valid contact id is required');
    }
  });
});
