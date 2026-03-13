import type { ContactResponse } from '$lib/api/contacts';

export type ContactsSortKey = 'updated_desc' | 'name_asc' | 'name_desc';

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase();
}

function byName(a: ContactResponse, b: ContactResponse): number {
  const lastCompare = normalize(a.lastName).localeCompare(normalize(b.lastName));
  if (lastCompare !== 0) {
    return lastCompare;
  }

  return normalize(a.firstName).localeCompare(normalize(b.firstName));
}

function byUpdatedDesc(a: ContactResponse, b: ContactResponse): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

export function matchesSearch(contact: ContactResponse, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  const haystack = [
    contact.firstName,
    contact.lastName,
    contact.email ?? '',
    contact.phone ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export function filterAndSortContacts(
  contacts: ContactResponse[],
  search: string,
  sortKey: ContactsSortKey
): ContactResponse[] {
  const filtered = contacts.filter((contact) => matchesSearch(contact, search));

  const sorted = [...filtered];

  if (sortKey === 'updated_desc') {
    sorted.sort(byUpdatedDesc);
    return sorted;
  }

  sorted.sort(byName);
  if (sortKey === 'name_desc') {
    sorted.reverse();
  }

  return sorted;
}
