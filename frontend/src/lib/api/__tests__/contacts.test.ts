import { describe, expect, it } from 'vitest';
import { isRequestError } from '$lib/api/errors';
import { deleteContact, getContact } from '$lib/api/contacts';

describe('contacts api guards', () => {
  it('rejects getContact when id is empty', () => {
    expect(() => getContact('tenant-a', 'token-123', '   ', 'corr-empty-get')).toThrowError(
      /Contact id is required/
    );
  });

  it('rejects deleteContact when id is empty', () => {
    try {
      deleteContact('tenant-a', 'token-123', '', 'corr-empty-delete');
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

