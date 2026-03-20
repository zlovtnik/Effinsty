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
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Input from '$lib/components/ui/Input.svelte';

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

  function metadataKeyError(rowId: string): string {
    const rowError = metadataErrors[rowId];
    if (!rowError) {
      return '';
    }

    const errors = [rowError.key, rowError.duplicate].filter(Boolean);
    return errors.join(' ');
  }

  function metadataValueError(rowId: string): string {
    return metadataErrors[rowId]?.value ?? '';
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
    <Field id="contact-first-name" label="First name" required error={fieldErrors.firstName}>
      <Input
        id="contact-first-name"
        name="contact-first-name"
        type="text"
        value={data.firstName}
        error={Boolean(fieldErrors.firstName)}
        aria-invalid={Boolean(fieldErrors.firstName)}
        oninput={(event) => setField('firstName', (event.currentTarget as HTMLInputElement).value)}
      />
    </Field>

    <Field id="contact-last-name" label="Last name" required error={fieldErrors.lastName}>
      <Input
        id="contact-last-name"
        name="contact-last-name"
        type="text"
        value={data.lastName}
        error={Boolean(fieldErrors.lastName)}
        aria-invalid={Boolean(fieldErrors.lastName)}
        oninput={(event) => setField('lastName', (event.currentTarget as HTMLInputElement).value)}
      />
    </Field>

    <Field id="contact-email" label="Email" error={fieldErrors.email}>
      <Input
        id="contact-email"
        name="contact-email"
        type="email"
        value={data.email}
        error={Boolean(fieldErrors.email)}
        aria-invalid={Boolean(fieldErrors.email)}
        oninput={(event) => setField('email', (event.currentTarget as HTMLInputElement).value)}
      />
    </Field>

    <Field id="contact-phone" label="Phone" error={fieldErrors.phone}>
      <Input
        id="contact-phone"
        name="contact-phone"
        type="tel"
        value={data.phone}
        error={Boolean(fieldErrors.phone)}
        aria-invalid={Boolean(fieldErrors.phone)}
        oninput={(event) => setField('phone', (event.currentTarget as HTMLInputElement).value)}
      />
    </Field>
  </div>

    <Field id="contact-address" label="Address" error={fieldErrors.address}>
      <textarea
        id="contact-address"
        name="contact-address"
        rows="3"
        value={data.address}
        aria-invalid={Boolean(fieldErrors.address)}
        oninput={(event) => setField('address', (event.currentTarget as HTMLTextAreaElement).value)}
      ></textarea>
    </Field>

  <section class="metadata-block" aria-label="Metadata fields">
    <div class="metadata-header">
      <h3>Metadata</h3>
      <Button type="button" variant="ghost" onclick={addMetadataRow}>Add metadata row</Button>
    </div>

    {#each data.metadataRows as row (row.id)}
      <div class="metadata-row">
        <Field id={`metadata-key-${row.id}`} label="Key" error={metadataKeyError(row.id)}>
          <Input
            id={`metadata-key-${row.id}`}
            type="text"
            value={row.key}
            error={Boolean(metadataKeyError(row.id))}
            aria-invalid={Boolean(metadataKeyError(row.id))}
            oninput={(event) => setMetadataRow(row.id, 'key', (event.currentTarget as HTMLInputElement).value)}
          />
        </Field>

        <Field id={`metadata-value-${row.id}`} label="Value" error={metadataValueError(row.id)}>
          <Input
            id={`metadata-value-${row.id}`}
            type="text"
            value={row.value}
            error={Boolean(metadataValueError(row.id))}
            aria-invalid={Boolean(metadataValueError(row.id))}
            oninput={(event) => setMetadataRow(row.id, 'value', (event.currentTarget as HTMLInputElement).value)}
          />
        </Field>

        <Button type="button" variant="danger-outline" onclick={() => removeMetadataRow(row.id)}>
          Remove
        </Button>
      </div>
    {/each}
  </section>

  <div class="actions">
    {#if onCancel}
      <Button type="button" variant="secondary" disabled={isSubmitting} onclick={onCancel}>
        Cancel
      </Button>
    {/if}

    <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
      {isSubmitting ? 'Saving...' : submitLabel}
    </Button>
  </div>
</form>

<style>
  .contact-form {
    display: grid;
    gap: 0.9rem;
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) - 2px);
    background: hsl(var(--card));
    padding: 1rem;
  }

  .grid {
    display: grid;
    gap: 0.75rem;
  }

  .two-col {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }

  textarea {
    width: 100%;
    min-height: 110px;
    border-radius: calc(var(--radius) - 4px);
    border: 1px solid hsl(var(--border));
    padding: 0.45rem 0.55rem;
    font: inherit;
    color: hsl(var(--foreground));
    background: hsl(var(--card));
  }

  .form-error {
    color: hsl(var(--destructive));
    font-size: 0.84rem;
  }

  .metadata-block {
    border: 1px dashed hsl(var(--border));
    border-radius: calc(var(--radius) - 4px);
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
    grid-template-columns: 1fr;
    gap: 0.6rem;
    align-items: end;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  @media (min-width: 769px) {
    .two-col {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .metadata-row {
      grid-template-columns: 1fr;
    }
  }
</style>
