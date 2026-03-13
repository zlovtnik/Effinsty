import { describe, expect, it } from 'vitest';
import {
  createEmptyContactFormData,
  validateContactForm,
} from '$lib/contacts/contact-form';

describe('contact form validation', () => {
  it('requires first and last name', () => {
    const data = createEmptyContactFormData();
    const result = validateContactForm(data);

    expect(result.isValid).toBe(false);
    expect(result.fieldErrors.firstName).toBe('First name is required.');
    expect(result.fieldErrors.lastName).toBe('Last name is required.');
  });

  it('normalizes email and phone to backend-compatible values', () => {
    const data = createEmptyContactFormData();
    data.firstName = '  Ada ';
    data.lastName = ' Lovelace  ';
    data.email = ' ADA@EXAMPLE.COM ';
    data.phone = '(555) 123-4567';

    const result = validateContactForm(data);

    expect(result.isValid).toBe(true);
    expect(result.normalized.firstName).toBe('Ada');
    expect(result.normalized.lastName).toBe('Lovelace');
    expect(result.normalized.email).toBe('ada@example.com');
    expect(result.normalized.phone).toBe('5551234567');
  });

  it('blocks duplicate metadata keys case-insensitively', () => {
    const data = createEmptyContactFormData();
    data.firstName = 'Ada';
    data.lastName = 'Lovelace';
    data.metadataRows = [
      { id: 'row-1', key: 'team', value: 'platform' },
      { id: 'row-2', key: 'TEAM', value: 'core' },
    ];

    const result = validateContactForm(data);

    expect(result.isValid).toBe(false);
    expect(result.metadataErrors['row-1']?.duplicate).toBe(
      'Metadata keys must be unique (case-insensitive).'
    );
    expect(result.metadataErrors['row-2']?.duplicate).toBe(
      'Metadata keys must be unique (case-insensitive).'
    );
  });
});
