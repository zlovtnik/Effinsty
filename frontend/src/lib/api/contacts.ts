import { contactsService } from '$lib/services/contacts/contacts.service';

export type {
  ContactCreateRequest,
  ContactResponse,
  ContactsService,
  ContactUpdateRequest,
  CreateContactCommand,
  DeleteContactCommand,
  GetContactQuery,
  ListContactsQuery,
  PagedResponse,
  SessionRequestContext,
  UpdateContactCommand,
} from '$lib/services/contacts/contacts.service';

export function listContacts(query: import('$lib/services/contacts/contacts.service').ListContactsQuery) {
  return contactsService.list(query);
}

export function getContact(query: import('$lib/services/contacts/contacts.service').GetContactQuery) {
  return contactsService.get(query);
}

export function createContact(command: import('$lib/services/contacts/contacts.service').CreateContactCommand) {
  return contactsService.create(command);
}

export function updateContact(command: import('$lib/services/contacts/contacts.service').UpdateContactCommand) {
  return contactsService.update(command);
}

export function deleteContact(command: import('$lib/services/contacts/contacts.service').DeleteContactCommand) {
  return contactsService.delete(command);
}
