<script lang="ts">
  import {
    createEmptyContactFormData,
    createEmptyMetadataRow,
    toCreatePayload,
    toUpdatePayload,
    validateContactForm,
    type ContactFormData,
    type ContactFormMode,
    type ContactFieldErrors,
  } from '$lib/contacts/contact-form';
  import type { MetadataRowErrors } from '$lib/contacts/contact-form';
  import type { ContactCreateRequest, ContactUpdateRequest } from '$lib/api/contacts';

  interface Props {
    mode: ContactFormMode;
    initialData?: ContactFormData;
    isSubmitting?: boolean;
    submitLabel?: string;
    onSubmit: (payload: ContactCreateRequest | ContactUpdateRequest) => Promise<void> | void;
    onCancel?: () => void;
  }

  let {
    mode,
    initialData = createEmptyContactFormData(),
    isSubmitting = false,
    submitLabel = mode === 'create' ? 'Create contact' : 'Save contact',
    onSubmit,
    onCancel,
  }: Props = $props();

  const cloneData = (value: ContactFormData): ContactFormData => ({
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    phone: value.phone,
    address: value.address,
    metadataRows: value.metadataRows.map((row) => ({ ...row })),
  });

  let data = $state<ContactFormData>(createEmptyContactFormData());
  let fieldErrors = $state<ContactFieldErrors>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
  });
  let metadataErrors = $state<Record<string, MetadataRowErrors>>({});
  let formError = $state('');

  $effect(() => {
    data = cloneData(initialData);
    fieldErrors = {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
    };
    metadataErrors = {};
    formError = '';
  });

  function setField(field: keyof Omit<ContactFormData, 'metadataRows'>, value: string): void {
    data = { ...data, [field]: value };
  }

  function setMetadataRow(id: string, field: 'key' | 'value', value: string): void {
    data = {
      ...data,
      metadataRows: data.metadataRows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    };
  }

  function addMetadataRow(): void {
    data = {
      ...data,
      metadataRows: [...data.metadataRows, createEmptyMetadataRow()],
    };
  }

  function removeMetadataRow(id: string): void {
    const remaining = data.metadataRows.filter((row) => row.id !== id);
    data = {
      ...data,
      metadataRows: remaining.length > 0 ? remaining : [createEmptyMetadataRow()],
    };
  }

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    formError = '';

    const validation = validateContactForm(data);
    fieldErrors = validation.fieldErrors;
    metadataErrors = validation.metadataErrors;

    if (!validation.isValid) {
      formError = 'Please fix the highlighted fields.';
      return;
    }

    const payload = mode === 'create'
      ? toCreatePayload(validation.normalized)
      : toUpdatePayload(validation.normalized);

    await onSubmit(payload);
  }
</script>

<form class="contact-form" onsubmit={(event) => void handleSubmit(event as SubmitEvent)} novalidate>
  {#if formError}
    <p class="form-error" role="alert">{formError}</p>
  {/if}

  <div class="grid two-col">
    <label>
      First name
      <input
        type="text"
        value={data.firstName}
        aria-invalid={Boolean(fieldErrors.firstName)}
        oninput={(event) => setField('firstName', (event.currentTarget as HTMLInputElement).value)}
      />
      {#if fieldErrors.firstName}
        <span class="field-error">{fieldErrors.firstName}</span>
      {/if}
    </label>

    <label>
      Last name
      <input
        type="text"
        value={data.lastName}
        aria-invalid={Boolean(fieldErrors.lastName)}
        oninput={(event) => setField('lastName', (event.currentTarget as HTMLInputElement).value)}
      />
      {#if fieldErrors.lastName}
        <span class="field-error">{fieldErrors.lastName}</span>
      {/if}
    </label>

    <label>
      Email
      <input
        type="email"
        value={data.email}
        aria-invalid={Boolean(fieldErrors.email)}
        oninput={(event) => setField('email', (event.currentTarget as HTMLInputElement).value)}
      />
      {#if fieldErrors.email}
        <span class="field-error">{fieldErrors.email}</span>
      {/if}
    </label>

    <label>
      Phone
      <input
        type="tel"
        value={data.phone}
        aria-invalid={Boolean(fieldErrors.phone)}
        oninput={(event) => setField('phone', (event.currentTarget as HTMLInputElement).value)}
      />
      {#if fieldErrors.phone}
        <span class="field-error">{fieldErrors.phone}</span>
      {/if}
    </label>
  </div>

  <label class="address-row">
    Address
    <textarea
      rows="3"
      value={data.address}
      aria-invalid={Boolean(fieldErrors.address)}
      oninput={(event) => setField('address', (event.currentTarget as HTMLTextAreaElement).value)}
    ></textarea>
    {#if fieldErrors.address}
      <span class="field-error">{fieldErrors.address}</span>
    {/if}
  </label>

  <section class="metadata-block" aria-label="Metadata fields">
    <div class="metadata-header">
      <h3>Metadata</h3>
      <button type="button" class="secondary" onclick={addMetadataRow}>Add metadata row</button>
    </div>

    {#each data.metadataRows as row (row.id)}
      <div class="metadata-row">
        <label>
          Key
          <input
            type="text"
            value={row.key}
            aria-invalid={Boolean(metadataErrors[row.id]?.key || metadataErrors[row.id]?.duplicate)}
            oninput={(event) => setMetadataRow(row.id, 'key', (event.currentTarget as HTMLInputElement).value)}
          />
          {#if metadataErrors[row.id]?.key}
            <span class="field-error">{metadataErrors[row.id]?.key}</span>
          {/if}
          {#if metadataErrors[row.id]?.duplicate}
            <span class="field-error">{metadataErrors[row.id]?.duplicate}</span>
          {/if}
        </label>

        <label>
          Value
          <input
            type="text"
            value={row.value}
            aria-invalid={Boolean(metadataErrors[row.id]?.value || metadataErrors[row.id]?.duplicate)}
            oninput={(event) => setMetadataRow(row.id, 'value', (event.currentTarget as HTMLInputElement).value)}
          />
          {#if metadataErrors[row.id]?.value}
            <span class="field-error">{metadataErrors[row.id]?.value}</span>
          {/if}
        </label>

        <button type="button" class="ghost" onclick={() => removeMetadataRow(row.id)}>Remove</button>
      </div>
    {/each}
  </section>

  <div class="actions">
    {#if onCancel}
      <button type="button" class="secondary" onclick={onCancel} disabled={isSubmitting}>Cancel</button>
    {/if}

    <button type="submit" class="primary" disabled={isSubmitting}>
      {isSubmitting ? 'Saving...' : submitLabel}
    </button>
  </div>
</form>

<style>
  .contact-form {
    display: grid;
    gap: 0.9rem;
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius-md);
    background: hsl(var(--surface));
    padding: 1rem;
  }

  .grid {
    display: grid;
    gap: 0.75rem;
  }

  .two-col {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  label {
    display: grid;
    gap: 0.35rem;
    font-size: 0.92rem;
  }

  input,
  textarea,
  button {
    font: inherit;
  }

  input,
  textarea {
    border-radius: var(--radius-sm);
    border: 1px solid hsl(var(--border));
    padding: 0.45rem 0.55rem;
    background: hsl(var(--surface));
    color: hsl(var(--text));
  }

  .address-row textarea {
    resize: vertical;
  }

  .form-error,
  .field-error {
    color: hsl(var(--danger));
    font-size: 0.84rem;
  }

  .metadata-block {
    border: 1px dashed hsl(var(--border));
    border-radius: var(--radius-sm);
    padding: 0.75rem;
    display: grid;
    gap: 0.65rem;
  }

  .metadata-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .metadata-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .metadata-row {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 0.6rem;
    align-items: end;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  button {
    border-radius: var(--radius-sm);
    padding: 0.4rem 0.7rem;
    border: 1px solid transparent;
    cursor: pointer;
  }

  .primary {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }

  .secondary,
  .ghost {
    background: hsl(var(--surface-muted));
    border-color: hsl(var(--border));
    color: hsl(var(--text));
  }

  button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .metadata-row {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 769px) {
    .two-col {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
