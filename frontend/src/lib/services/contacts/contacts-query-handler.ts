import {
  contactsService,
  type ContactsService,
  type GetContactQuery,
  type ListContactsQuery,
  type PagedResponse,
  type ContactResponse,
} from '$lib/services/contacts/contacts.service';

export interface ContactsQueryHandler {
  list(query: ListContactsQuery): Promise<PagedResponse<ContactResponse>>;
  get(query: GetContactQuery): Promise<ContactResponse>;
}

export interface ContactsQueryHandlerDependencies {
  contactsService?: Pick<ContactsService, 'list' | 'get'>;
}

export function createContactsQueryHandler(
  dependencies: ContactsQueryHandlerDependencies = {}
): ContactsQueryHandler {
  const contactsServiceImpl = dependencies.contactsService ?? contactsService;

  return {
    list(query) {
      return contactsServiceImpl.list(query);
    },
    get(query) {
      return contactsServiceImpl.get(query);
    },
  };
}

export const contactsQueryHandler = createContactsQueryHandler();
