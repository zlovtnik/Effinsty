import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { sessionStore } from '$lib/stores/session.store';

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStore.reset();
  });

  it('starts without a refresh token', () => {
    expect(get(sessionStore)).toEqual({
      refreshToken: null,
    });
  });

  it('stores refresh token in memory only', () => {
    sessionStore.setRefreshToken('refresh-token');

    expect(get(sessionStore)).toEqual({
      refreshToken: 'refresh-token',
    });
  });

  it('clears refresh token during clear', () => {
    sessionStore.setRefreshToken('refresh-token');
    sessionStore.clear();

    expect(get(sessionStore)).toEqual({
      refreshToken: null,
    });
  });
});
