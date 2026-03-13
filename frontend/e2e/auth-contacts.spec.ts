import { expect, test } from '@playwright/test';
import { TEST_SESSION_EXPIRY } from '../src/lib/test/auth-fixtures';

test('login, list, create, edit, delete, and logout with mocked API flows', async ({ page }) => {
  let currentContact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    metadata: Record<string, string>;
    createdAt: string;
    updatedAt: string;
  } | null = {
    id: 'contact-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '5551111111',
    address: null,
    metadata: {},
    createdAt: '2026-03-10T12:00:00Z',
    updatedAt: '2026-03-12T12:00:00Z',
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/auth/login' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-login' },
        body: JSON.stringify({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: TEST_SESSION_EXPIRY,
        }),
      });
      return;
    }

    if (path === '/api/auth/logout' && request.method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    if (path === '/api/health' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-health' },
        body: JSON.stringify({ status: 'healthy' }),
      });
      return;
    }

    if (path === '/api/contacts' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-list' },
        body: JSON.stringify({
          items: currentContact ? [currentContact] : [],
          page: 1,
          pageSize: 20,
          totalCount: currentContact ? 1 : 0,
        }),
      });
      return;
    }

    if (path === '/api/contacts' && request.method() === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}');
      currentContact = {
        id: 'contact-2',
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.address ?? null,
        metadata: payload.metadata ?? {},
        createdAt: '2026-03-13T12:30:00Z',
        updatedAt: '2026-03-13T12:30:00Z',
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-create' },
        body: JSON.stringify(currentContact),
      });
      return;
    }

    if (path.startsWith('/api/contacts/') && request.method() === 'GET') {
      if (!currentContact) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'not_found',
            message: 'Contact was not found.',
            details: [],
            correlationId: 'corr-missing',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-detail' },
        body: JSON.stringify(currentContact),
      });
      return;
    }

    if (path.startsWith('/api/contacts/') && request.method() === 'PUT') {
      if (!currentContact) {
        await route.abort();
        return;
      }

      const payload = JSON.parse(request.postData() ?? '{}');
      currentContact = {
        ...currentContact,
        ...payload,
        email: payload.email ?? currentContact.email,
        updatedAt: '2026-03-13T12:45:00Z',
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-update' },
        body: JSON.stringify(currentContact),
      });
      return;
    }

    if (path.startsWith('/api/contacts/') && request.method() === 'DELETE') {
      currentContact = null;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Correlation-ID': 'corr-delete' },
        body: JSON.stringify({ success: true }),
      });
      return;
    }

    await route.abort();
  });

  await page.goto('/login?returnTo=%2Fdashboard%2Fcontacts');
  await page.getByLabel('Tenant ID').fill('tenant-a');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Ada Lovelace')).toBeVisible();

  await page.getByRole('button', { name: 'New contact' }).click();
  await page.getByLabel(/First name/).fill('Grace');
  await page.getByLabel(/Last name/).fill('Hopper');
  await page.getByLabel(/Email/).fill('grace@example.com');
  await page.getByRole('button', { name: 'Create contact' }).click();

  await expect(page.getByText('Grace Hopper')).toBeVisible();

  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel(/Email/).fill('grace.hopper@example.com');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByText('grace.hopper@example.com')).toBeVisible();

  await page.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).nth(1).click();

  await expect(page.getByText('No contacts found')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
});
