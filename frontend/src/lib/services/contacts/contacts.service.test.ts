import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRequestError } from '$lib/api/errors';
import {
  createContactsService,
  type ContactsService,
} from '$lib/services/contacts/contacts.service';

describe('contacts service', () => {
  const requestWithAuthMock = vi.fn();
  let service: ContactsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createContactsService({
      requestWithAuth: requestWithAuthMock,
    });
  });

  it('clamps paging before dispatching list requests', async () => {
    requestWithAuthMock.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 100,
      totalCount: 0,
    });

    await service.list({
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

  it('rejects blank contact ids before calling the transport', async () => {
    try {
      await service.get({
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

  it('uses contact-specific paths for update and delete', async () => {
    requestWithAuthMock.mockResolvedValue({ success: true });

    await service.update({
      context: { tenantId: 'tenant-a' },
      id: 'contact-1',
      payload: { firstName: 'Ada' },
    });
    await service.delete({
      context: { tenantId: 'tenant-a' },
      id: 'contact-1',
    });

    expect(requestWithAuthMock).toHaveBeenNthCalledWith(1, '/contacts/contact-1', {
      method: 'PUT',
      body: { firstName: 'Ada' },
      tenantId: 'tenant-a',
      correlationId: undefined,
    });
    expect(requestWithAuthMock).toHaveBeenNthCalledWith(2, '/contacts/contact-1', {
      method: 'DELETE',
      tenantId: 'tenant-a',
      correlationId: undefined,
    });
  });
});
