<script lang="ts">
  import { onMount } from 'svelte';
  import ContactList from '$lib/components/contacts/ContactList.svelte';
  import { ContactsListController } from './contacts-list.controller.svelte';

  const controller = new ContactsListController();

  onMount(() => {
    void controller.mount();
  });
</script>

<ContactList
  state={controller.state}
  isBusy={controller.isBusy}
  filteredContacts={controller.filteredContacts}
  errorMessage={controller.error.message}
  errorDetails={controller.error.details}
  errorCorrelationId={controller.error.correlationId}
  page={controller.page}
  pageSize={controller.pageSize}
  totalCount={controller.totalCount}
  search={controller.search}
  searchLabel={controller.searchLabel}
  sortKey={controller.sortKey}
  onSearch={(value) => controller.updateSearch(value)}
  onSort={(value) => controller.updateSort(value)}
  onRetry={() => controller.retry()}
  onCreate={() => controller.navigateToNew()}
  onPageChange={(page) => controller.changePage(page)}
  onPageSizeChange={(size) => controller.changePageSize(size)}
  onView={(id) => controller.navigateToDetails(id)}
  onEdit={(id) => controller.navigateToEdit(id)}
  onDelete={(contact) => controller.deleteFromList(contact)}
/>
