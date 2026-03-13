import type {
  ContactCreateRequest,
  ContactResponse,
  ContactUpdateRequest,
} from '$lib/api/contacts';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

export type ContactFormMode = 'create' | 'edit';

export interface MetadataRow {
  id: string;
  key: string;
  value: string;
}

export interface ContactFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  metadataRows: MetadataRow[];
}

export interface ContactFieldErrors {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}

export interface MetadataRowErrors {
  key?: string;
  value?: string;
  duplicate?: string;
}

export interface ContactFormValidationResult {
  isValid: boolean;
  fieldErrors: ContactFieldErrors;
  metadataErrors: Record<string, MetadataRowErrors>;
  normalized: ContactCreateRequest;
}

function emptyFieldErrors(): ContactFieldErrors {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  };
}

function trimOrEmpty(value: string): string {
  return value.trim();
}

function normalizeEmail(value: string): string | undefined {
  const normalized = trimOrEmpty(value).toLowerCase();
  return normalized ? normalized : undefined;
}

function normalizePhone(value: string): string | undefined {
  const digits = value
    .split('')
    .filter((char) => /\d/.test(char))
    .join('');

  return digits ? digits : undefined;
}

function normalizeAddress(value: string): string | undefined {
  const normalized = trimOrEmpty(value);
  return normalized ? normalized : undefined;
}

function metadataRowsToPayload(
  rows: MetadataRow[],
  metadataErrors: Record<string, MetadataRowErrors>
): Record<string, string> {
  const payload: Record<string, string> = {};

  for (const row of rows) {
    if (metadataErrors[row.id]) {
      continue;
    }

    const key = trimOrEmpty(row.key);
    const value = trimOrEmpty(row.value);

    if (!key || !value) {
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

export function createEmptyMetadataRow(): MetadataRow {
  return {
    id: createId(),
    key: '',
    value: '',
  };
}

export function createEmptyContactFormData(): ContactFormData {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    metadataRows: [createEmptyMetadataRow()],
  };
}

export function contactToFormData(contact: ContactResponse): ContactFormData {
  const metadataRows = Object.entries(contact.metadata ?? {}).map(([key, value]) => ({
    id: createId(),
    key,
    value,
  }));

  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    address: contact.address ?? '',
    metadataRows: metadataRows.length > 0 ? metadataRows : [createEmptyMetadataRow()],
  };
}

export function validateContactForm(data: ContactFormData): ContactFormValidationResult {
  const fieldErrors = emptyFieldErrors();
  const metadataErrors: Record<string, MetadataRowErrors> = {};

  const firstName = trimOrEmpty(data.firstName);
  const lastName = trimOrEmpty(data.lastName);
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  const address = normalizeAddress(data.address);

  if (!firstName) {
    fieldErrors.firstName = 'First name is required.';
  }

  if (!lastName) {
    fieldErrors.lastName = 'Last name is required.';
  }

  if (email && !EMAIL_REGEX.test(email)) {
    fieldErrors.email = 'Email format is invalid.';
  }

  if (phone && (phone.length < 10 || phone.length > 15)) {
    fieldErrors.phone = 'Phone number must contain 10 to 15 digits.';
  }

  const duplicateBuckets = new Map<string, string[]>();

  for (const row of data.metadataRows) {
    const key = trimOrEmpty(row.key);
    const value = trimOrEmpty(row.value);

    if (!key && !value) {
      continue;
    }

    if (!key) {
      metadataErrors[row.id] = {
        ...(metadataErrors[row.id] ?? {}),
        key: 'Metadata key is required when value is set.',
      };
    }

    if (!value) {
      metadataErrors[row.id] = {
        ...(metadataErrors[row.id] ?? {}),
        value: 'Metadata value is required when key is set.',
      };
    }

    if (key) {
      const duplicateKey = key.toLowerCase();
      const rowsForKey = duplicateBuckets.get(duplicateKey) ?? [];
      rowsForKey.push(row.id);
      duplicateBuckets.set(duplicateKey, rowsForKey);
    }
  }

  for (const ids of duplicateBuckets.values()) {
    if (ids.length <= 1) {
      continue;
    }

    for (const id of ids) {
      metadataErrors[id] = {
        ...(metadataErrors[id] ?? {}),
        duplicate: 'Metadata keys must be unique (case-insensitive).',
      };
    }
  }

  const hasFieldErrors = Object.values(fieldErrors).some(Boolean);
  const hasMetadataErrors = Object.keys(metadataErrors).length > 0;

  const normalized: ContactCreateRequest = {
    firstName,
    lastName,
    email,
    phone,
    address,
    metadata: metadataRowsToPayload(data.metadataRows, metadataErrors),
  };

  return {
    isValid: !hasFieldErrors && !hasMetadataErrors,
    fieldErrors,
    metadataErrors,
    normalized,
  };
}

export function toCreatePayload(normalized: ContactCreateRequest): ContactCreateRequest {
  return {
    ...normalized,
    metadata: normalized.metadata ?? {},
  };
}

export function toUpdatePayload(normalized: ContactCreateRequest): ContactUpdateRequest {
  return {
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    email: normalized.email,
    phone: normalized.phone,
    address: normalized.address,
    metadata: normalized.metadata ?? {},
  };
}
