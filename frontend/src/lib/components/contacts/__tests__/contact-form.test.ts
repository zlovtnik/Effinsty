// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ContactForm from '$lib/components/contacts/ContactForm.svelte';
import { createEmptyContactFormData } from '$lib/contacts/contact-form';

describe('ContactForm', () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows required field errors when submitted empty', async () => {
    render(ContactForm, {
      mode: 'create',
      initialData: createEmptyContactFormData(),
      onSubmit,
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Create contact' }));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(await screen.findByText('Last name is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('blocks duplicate metadata keys case-insensitively', async () => {
    const data = createEmptyContactFormData();

    render(ContactForm, {
      mode: 'create',
      initialData: data,
      onSubmit,
    });

    await fireEvent.input(screen.getByRole('textbox', { name: /First name/ }), { target: { value: 'Ada' } });
    await fireEvent.input(screen.getByRole('textbox', { name: /Last name/ }), { target: { value: 'Lovelace' } });

    await fireEvent.input(screen.getAllByRole('textbox', { name: /Key/ })[0]!, { target: { value: 'team' } });
    await fireEvent.input(screen.getAllByRole('textbox', { name: /Value/ })[0]!, { target: { value: 'platform' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add metadata row' }));

    const keyInputs = screen.getAllByRole('textbox', { name: /Key/ });
    const valueInputs = screen.getAllByRole('textbox', { name: /Value/ });

    expect(keyInputs).toHaveLength(2);
    expect(valueInputs).toHaveLength(2);

    await fireEvent.input(keyInputs[1]!, { target: { value: 'TEAM' } });
    await fireEvent.input(valueInputs[1]!, { target: { value: 'core' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Create contact' }));

    expect(await screen.findAllByText('Metadata keys must be unique (case-insensitive).')).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits normalized payload values', async () => {
    render(ContactForm, {
      mode: 'create',
      initialData: createEmptyContactFormData(),
      onSubmit,
    });

    await fireEvent.input(screen.getByRole('textbox', { name: /First name/ }), { target: { value: ' Ada ' } });
    await fireEvent.input(screen.getByRole('textbox', { name: /Last name/ }), { target: { value: ' Lovelace ' } });
    await fireEvent.input(screen.getByRole('textbox', { name: /Email/ }), { target: { value: ' ADA@EXAMPLE.COM ' } });
    await fireEvent.input(screen.getByRole('textbox', { name: /Phone/ }), { target: { value: '(555) 123-4567' } });

    await fireEvent.click(screen.getByRole('button', { name: 'Create contact' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '5551234567',
      })
    );
  });
});
