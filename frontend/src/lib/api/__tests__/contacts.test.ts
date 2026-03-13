// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { isRequestError } from '$lib/api/errors';
import { deleteContact, getContact, listContacts, updateContact } from '$lib/api/contacts';
import { server } from '$lib/api/__tests__/msw/server';

const context = {
  tenantId: 'tenant-a',
  accessToken: 'token-123',
};

describe('contacts api guards', () => {
  it('rejects getContact when id is empty', async () => {
    await expect(
      getContact({ context, id: '   ', correlationId: 'corr-empty-get' })
    ).rejects.toThrow(/Contact id is required/);
  });

  it('rejects updateContact when id is empty', async () => {
    await expect(
      updateContact({
        context,
        id: '   ',
        payload: { firstName: 'Ada', lastName: 'Lovelace' },
        correlationId: 'corr-empty-update',
      })
    ).rejects.toThrow(/Contact id is required/);
  });

  it('rejects deleteContact when id is empty', async () => {
    try {
      await deleteContact({ context, id: '', correlationId: 'corr-empty-delete' });
      throw new Error('Expected deleteContact to throw');
    } catch (error) {
      expect(isRequestError(error)).toBe(true);
      if (!isRequestError(error)) {
        return;
      }

      expect(error.appError.kind).toBe('network');
      expect(error.appError.message).toContain('Contact id is required');
      expect(error.appError.message).toContain('tenant-a');
    }
  });
});

describe('contacts api paging guards', () => {
  it('clamps page and pageSize before request dispatch', async () => {
    let requestedPage = '';
    let requestedPageSize = '';

    server.use(
      http.get('http://localhost/api/contacts', ({ request }) => {
        const url = new URL(request.url);
        requestedPage = url.searchParams.get('page') ?? '';
        requestedPageSize = url.searchParams.get('pageSize') ?? '';

        return HttpResponse.json({
          items: [],
          page: Number(requestedPage),
          pageSize: Number(requestedPageSize),
          totalCount: 0,
        });
      })
    );

    await listContacts({ context, page: 0, pageSize: 999, correlationId: 'corr-clamp' });

    expect(requestedPage).toBe('1');
    expect(requestedPageSize).toBe('100');
  });
});
