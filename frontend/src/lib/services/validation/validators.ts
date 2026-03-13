const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type LoginFieldName = 'tenantId' | 'username' | 'password';

export interface LoginValidationResult {
  isValid: boolean;
  fieldErrors: Record<LoginFieldName, string>;
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function normalizeTrimmed(value: string): string {
  return value.trim();
}

export function normalizeOptional(value: string): string | undefined {
  const normalized = normalizeTrimmed(value);
  return normalized ? normalized : undefined;
}

export function normalizeEmail(value: string): string | undefined {
  const normalized = normalizeTrimmed(value).toLowerCase();
  return normalized ? normalized : undefined;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function normalizePhone(value: string): string | undefined {
  const digits = value
    .split('')
    .filter((char) => /\d/.test(char))
    .join('');

  return digits ? digits : undefined;
}

export function isValidPhone(value: string): boolean {
  return value.length >= 10 && value.length <= 15;
}

export function clampPositiveInt(
  value: number,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, Math.trunc(value)));
}

export function validateLoginFields(input: {
  tenantId: string;
  username: string;
  password: string;
}): LoginValidationResult {
  const fieldErrors: Record<LoginFieldName, string> = {
    tenantId: '',
    username: '',
    password: '',
  };

  if (!isNonEmpty(input.tenantId)) {
    fieldErrors.tenantId = 'Tenant ID is required.';
  }

  if (!isNonEmpty(input.username)) {
    fieldErrors.username = 'Username is required.';
  }

  if (!isNonEmpty(input.password)) {
    fieldErrors.password = 'Password is required.';
  }

  return {
    isValid: !Object.values(fieldErrors).some(Boolean),
    fieldErrors,
  };
}
