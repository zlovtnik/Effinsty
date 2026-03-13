function fallbackId(): string {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return fallbackId();
}

export const IdGenerator = {
  uuid(): string {
    return generateUuid();
  },
  correlationId(): string {
    return generateUuid();
  },
};
