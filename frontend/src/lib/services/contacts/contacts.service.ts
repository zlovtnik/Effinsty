import { requestWithAuth } from '$lib/api/authenticated';
import { RequestError, toNetworkError } from '$lib/api/errors';
import { clampPositiveInt } from '$lib/services/validation/validators';

export interface SessionRequestContext {
  tenantId: string;
}

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

export interface ListContactsQuery {
  context: SessionRequestContext;
  page?: number;
  pageSize?: number;
  correlationId?: string;
}

export interface GetContactQuery {
  context: SessionRequestContext;
  id: string;
  correlationId?: string;
}

export interface CreateContactCommand {
  context: SessionRequestContext;
  payload: ContactCreateRequest;
  correlationId?: string;
}

export interface UpdateContactCommand {
  context: SessionRequestContext;
  id: string;
  payload: ContactUpdateRequest;
  correlationId?: string;
}

export interface DeleteContactCommand {
  context: SessionRequestContext;
  id: string;
  correlationId?: string;
}

export interface ContactsService {
  list(query: ListContactsQuery): Promise<PagedResponse<ContactResponse>>;
  get(query: GetContactQuery): Promise<ContactResponse>;
  create(command: CreateContactCommand): Promise<ContactResponse>;
  update(command: UpdateContactCommand): Promise<ContactResponse>;
  delete(command: DeleteContactCommand): Promise<{ success: boolean }>;
}

export interface ContactsServiceDependencies {
  requestWithAuth?: typeof requestWithAuth;
}

function requireBody<T>(payload: T | null, endpoint: string): T {
  if (payload === null) {
    throw new RequestError(toNetworkError(`Empty response body from ${endpoint}.`));
  }

  return payload;
}

function requireContactId(id: string, tenantId: string, correlationId?: string): string {
  const normalizedId = id.trim();
  const hasSafeFormat = /^[A-Za-z0-9_-]+$/.test(normalizedId);
  if (!normalizedId || !hasSafeFormat) {
    const correlationContext = correlationId ? ` CorrelationId=${correlationId}.` : '';
    throw new RequestError(
      toNetworkError(
        `Valid contact id is required for tenant "${tenantId}".${correlationContext}`
      )
    );
  }

  return normalizedId;
}

export function createContactsService(dependencies: ContactsServiceDependencies = {}): ContactsService {
  const requestWithAuthImpl = dependencies.requestWithAuth ?? requestWithAuth;

  return {
    async list({ context, page = 1, pageSize = 20, correlationId }) {
      const safePage = clampPositiveInt(page, 1);
      const safePageSize = clampPositiveInt(pageSize, 20, 100);
      const params = new URLSearchParams({
        page: String(safePage),
        pageSize: String(safePageSize),
      });

      return requireBody(
        await requestWithAuthImpl<PagedResponse<ContactResponse>>(`/contacts?${params.toString()}`, {
          method: 'GET',
          tenantId: context.tenantId,
          correlationId,
        }),
        '/contacts'
      );
    },
    async get({ context, id, correlationId }) {
      const contactId = requireContactId(id, context.tenantId, correlationId);
      return requireBody(
        await requestWithAuthImpl<ContactResponse>(`/contacts/${contactId}`, {
          method: 'GET',
          tenantId: context.tenantId,
          correlationId,
        }),
        `/contacts/${contactId}`
      );
    },
    async create({ context, payload, correlationId }) {
      return requireBody(
        await requestWithAuthImpl<ContactResponse>('/contacts', {
          method: 'POST',
          body: payload,
          tenantId: context.tenantId,
          correlationId,
        }),
        '/contacts'
      );
    },
    async update({ context, id, payload, correlationId }) {
      const contactId = requireContactId(id, context.tenantId, correlationId);
      return requireBody(
        await requestWithAuthImpl<ContactResponse>(`/contacts/${contactId}`, {
          method: 'PUT',
          body: payload,
          tenantId: context.tenantId,
          correlationId,
        }),
        `/contacts/${contactId}`
      );
    },
    async delete({ context, id, correlationId }) {
      const contactId = requireContactId(id, context.tenantId, correlationId);
      return requireBody(
        await requestWithAuthImpl<{ success: boolean }>(`/contacts/${contactId}`, {
          method: 'DELETE',
          tenantId: context.tenantId,
          correlationId,
        }),
        `/contacts/${contactId}`
      );
    },
  };
}

export const contactsService = createContactsService();
