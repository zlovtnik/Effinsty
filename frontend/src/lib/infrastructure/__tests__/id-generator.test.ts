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

    expect(IdGenerator.correlationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });
});
