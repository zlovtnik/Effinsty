import { request } from '$lib/api/client';
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

export function listContacts(
  tenantId: string,
  accessToken: string,
  page = 1,
  pageSize = 20,
  correlationId?: string
) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  return request<PagedResponse<ContactResponse>>(`/contacts?${params.toString()}`, {
    method: 'GET',
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, '/contacts'));
}

export function getContact(tenantId: string, accessToken: string, id: string, correlationId?: string) {
  return request<ContactResponse>(`/contacts/${id}`, {
    method: 'GET',
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, `/contacts/${id}`));
}

export function createContact(
  tenantId: string,
  accessToken: string,
  payload: ContactCreateRequest,
  correlationId?: string
) {
  return request<ContactResponse>('/contacts', {
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
  return request<ContactResponse>(`/contacts/${id}`, {
    method: 'PUT',
    body: payload,
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, `/contacts/${id}`));
}

export function deleteContact(tenantId: string, accessToken: string, id: string, correlationId?: string) {
  return request<{ success: boolean }>(`/contacts/${id}`, {
    method: 'DELETE',
    tenantId,
    accessToken,
    correlationId,
  }).then((response) => requireBody(response, `/contacts/${id}`));
}
