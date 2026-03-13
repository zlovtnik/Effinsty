import { afterEach, describe, expect, it } from 'vitest';
import { IdGenerator } from '$lib/infrastructure/crypto/id-generator';

const originalCrypto = globalThis.crypto;

describe('IdGenerator', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      value: originalCrypto,
      configurable: true,
    });
  });

  it('uses crypto.randomUUID when available', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => 'uuid-from-crypto' },
      configurable: true,
    });

    expect(IdGenerator.uuid()).toBe('uuid-from-crypto');
    expect(IdGenerator.correlationId()).toBe('uuid-from-crypto');
  });

  it('falls back to a generated identifier when crypto is unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
    });

    expect(IdGenerator.correlationId()).toMatch(/^[a-f0-9]+-[a-f0-9]+$/i);
  });
});
