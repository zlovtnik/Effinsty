import type {
  ContactCreateRequest,
  ContactResponse,
  ContactUpdateRequest,
} from '$lib/api/contacts';
import { IdGenerator } from '$lib/infrastructure/crypto/id-generator';
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizeOptional,
  normalizePhone,
  normalizeTrimmed,
} from '$lib/services/validation/validators';

function createId(): string {
  return IdGenerator.uuid();
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

function metadataRowsToPayload(
  rows: MetadataRow[],
  metadataErrors: Record<string, MetadataRowErrors>
): Record<string, string> {
  const payload: Record<string, string> = {};

  for (const row of rows) {
    if (metadataErrors[row.id]) {
      continue;
    }

    const key = normalizeTrimmed(row.key);
    const value = normalizeTrimmed(row.value);

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

  const firstName = normalizeTrimmed(data.firstName);
  const lastName = normalizeTrimmed(data.lastName);
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  const address = normalizeOptional(data.address);

  if (!firstName) {
    fieldErrors.firstName = 'First name is required.';
  }

  if (!lastName) {
    fieldErrors.lastName = 'Last name is required.';
  }

  if (email && !isValidEmail(email)) {
    fieldErrors.email = 'Email format is invalid.';
  }

  if (phone && !isValidPhone(phone)) {
    fieldErrors.phone = 'Phone number must contain 10 to 15 digits.';
  }

  const duplicateBuckets = new Map<string, string[]>();

  for (const row of data.metadataRows) {
    const key = normalizeTrimmed(row.key);
    const value = normalizeTrimmed(row.value);

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
