import { requestWithAuth } from '$lib/api/authenticated';
import { RequestError, toNetworkError } from '$lib/api/errors';

export interface ContactResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactCreateRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  metadata?: Record<string, string>;
}

export interface ContactUpdateRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  metadata?: Record<string, string>;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

function requireBody<T>(payload: T | null, endpoint: string): T {
  if (payload === null) {
    throw new RequestError(toNetworkError(`Empty response body from ${endpoint}.`));
  }

  return payload;
}

function requireContactId(id: string, tenantId: string, correlationId?: string): string {
  const normalizedId = id.trim();
  if (!normalizedId) {
    const correlationContext = correlationId ? ` CorrelationId=${correlationId}.` : '';
    throw new RequestError(
      toNetworkError(`Contact id is required for tenant "${tenantId}".${correlationContext}`)
    );
  }

  return normalizedId;
}

export function listContacts(
  tenantId: string,
  accessToken: string,
  page = 1,
  pageSize = 20,
  correlationId?: string
) {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const safePageSize = Number.isFinite(pageSize)
    ? Math.min(100, Math.max(1, Math.trunc(pageSize)))
    : 20;

  const params = new URLSearchParams({
    page: String(safePage),
    pageSize: String(safePageSize),
  });

  return requestWithAuth<PagedResponse<ContactResponse>>(`/contacts?${params.toString()}`, {
    method: 'GET',
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, '/contacts'));
}

export function getContact(tenantId: string, accessToken: string, id: string, correlationId?: string) {
  const contactId = requireContactId(id, tenantId, correlationId);
  return requestWithAuth<ContactResponse>(`/contacts/${contactId}`, {
    method: 'GET',
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, `/contacts/${contactId}`));
}

export function createContact(
  tenantId: string,
  accessToken: string,
  payload: ContactCreateRequest,
  correlationId?: string
) {
  return requestWithAuth<ContactResponse>('/contacts', {
    method: 'POST',
    body: payload,
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, '/contacts'));
}

export function updateContact(
  tenantId: string,
  accessToken: string,
  id: string,
  payload: ContactUpdateRequest,
  correlationId?: string
) {
  const contactId = requireContactId(id, tenantId, correlationId);
  return requestWithAuth<ContactResponse>(`/contacts/${contactId}`, {
    method: 'PUT',
    body: payload,
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, `/contacts/${contactId}`));
}

export function deleteContact(tenantId: string, accessToken: string, id: string, correlationId?: string) {
  const contactId = requireContactId(id, tenantId, correlationId);
  return requestWithAuth<{ success: boolean }>(`/contacts/${contactId}`, {
    method: 'DELETE',
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, `/contacts/${contactId}`));
}
