// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';

let afterNavigateCallback:
  | ((navigation: {
      from: { url: URL } | null;
      to: { url: URL } | null;
    }) => void)
  | undefined;

vi.mock('$app/navigation', () => ({
  afterNavigate: vi.fn((callback) => {
    afterNavigateCallback = callback;
  }),
}));

vi.mock('$lib/utils/telemetry', () => ({
  trackError: vi.fn(),
  trackPage: vi.fn(),
  trackWebVital: vi.fn(),
}));

vi.mock('$lib/utils/web-vitals', () => ({
  registerWebVitals: vi.fn(),
}));

import Layout from '../+layout.svelte';
import { registerWebVitals } from '$lib/utils/web-vitals';
import { trackError, trackPage } from '$lib/utils/telemetry';

const registerWebVitalsMock = vi.mocked(registerWebVitals);
const trackErrorMock = vi.mocked(trackError);
const trackPageMock = vi.mocked(trackPage);

describe('root layout telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    afterNavigateCallback = undefined;
    window.history.replaceState({}, '', '/dashboard/contacts?page=2');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('tracks initial load once and ignores the initial afterNavigate event', () => {
    render(Layout);

    expect(trackPageMock).toHaveBeenCalledTimes(1);
    expect(trackPageMock).toHaveBeenCalledWith('page_view', {
      navigation: 'load',
      title: document.title,
      to: '/dashboard/contacts?page=2',
    });

    afterNavigateCallback?.({
      from: null,
      to: { url: new URL('http://localhost/dashboard/contacts?page=2') },
    });

    expect(trackPageMock).toHaveBeenCalledTimes(1);
  });

  it('tracks subsequent navigations', () => {
    render(Layout);

    afterNavigateCallback?.({
      from: { url: new URL('http://localhost/dashboard') },
      to: { url: new URL('http://localhost/dashboard/contacts?page=2') },
    });

    expect(trackPageMock).toHaveBeenCalledWith('page_view', {
      navigation: 'navigate',
      title: document.title,
      from: '/dashboard',
      to: '/dashboard/contacts?page=2',
    });
  });

  it('reports web-vitals loader failures without unhandled rejections', async () => {
    vi.stubEnv('PUBLIC_ENABLE_WEB_VITALS', 'true');
    registerWebVitalsMock.mockRejectedValue(new Error('missing module'));

    render(Layout);

    await waitFor(() => {
      expect(trackErrorMock).toHaveBeenCalledWith('web_vitals_import_failure', {
        message: 'web-vitals import failed',
        details: ['missing module'],
      });
    });
  });
});
