import { describe, expect, it } from 'vitest';
import {
  clampPositiveInt,
  isNonEmpty,
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  validateLoginFields,
} from '$lib/services/validation/validators';

describe('validation helpers', () => {
  it('validates required login fields', () => {
    expect(
      validateLoginFields({
        tenantId: ' ',
        username: '',
        password: '',
      })
    ).toEqual({
      isValid: false,
      fieldErrors: {
        tenantId: 'Tenant ID is required.',
        username: 'Username is required.',
        password: 'Password is required.',
      },
    });
  });

  it('normalizes email and phone values', () => {
    expect(normalizeEmail(' ADA@EXAMPLE.COM ')).toBe('ada@example.com');
    expect(normalizePhone('(555) 123-4567')).toBe('5551234567');
  });

  it('exposes reusable primitive validators', () => {
    expect(isNonEmpty(' value ')).toBe(true);
    expect(isValidEmail(' ADA@EXAMPLE.COM ')).toBe(true);
    expect(isValidEmail('ada@example.com')).toBe(true);
    expect(isValidPhone('(555) 123-4567')).toBe(true);
    expect(isValidPhone('5551234567')).toBe(true);
    expect(clampPositiveInt(999, 1, 100)).toBe(100);
    expect(clampPositiveInt(5, 1, 0)).toBe(1);
  });
});
