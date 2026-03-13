import { describe, expect, it } from 'vitest';
import { filterAndSortContacts } from '$lib/contacts/listing';
import type { ContactResponse } from '$lib/api/contacts';

const contacts: ContactResponse[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '5551111111',
    address: null,
    metadata: {},
    createdAt: '2026-03-10T12:00:00Z',
    updatedAt: '2026-03-11T12:00:00Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace@example.com',
    phone: '5552222222',
    address: null,
    metadata: {},
    createdAt: '2026-03-10T12:00:00Z',
    updatedAt: '2026-03-12T12:00:00Z',
  },
];

describe('contacts listing utilities', () => {
  it('filters by page-scoped search fields', () => {
    const results = filterAndSortContacts(contacts, '555111', 'updated_desc');

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('sorts by updated desc by default option', () => {
    const results = filterAndSortContacts(contacts, '', 'updated_desc');

    expect(results[0]?.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(results[1]?.id).toBe('11111111-1111-1111-1111-111111111111');
  });
});
