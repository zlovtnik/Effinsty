// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
import { uiStore } from '$lib/stores/ui.store';

async function openDialog() {
  const confirmationPromise = uiStore.requestConfirmation({
    title: 'Delete contact',
    message: 'Delete this contact? This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    tone: 'danger',
  });

  const dialog = await screen.findByRole('dialog');
  return { confirmationPromise, dialog };
}

describe('ConfirmDialog focus management', () => {
  beforeEach(() => {
    uiStore.reset();
    document.body.innerHTML = '';
  });

  it('auto-focuses the first actionable control when opened', async () => {
    render(ConfirmDialog);
    await openDialog();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });
  });

  it('traps keyboard tab navigation within the dialog', async () => {
    render(ConfirmDialog);
    const { dialog } = await openDialog();

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    const deleteButton = screen.getByRole('button', { name: 'Delete' });

    deleteButton.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(cancelButton).toHaveFocus();

    cancelButton.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(deleteButton).toHaveFocus();
  });

  it('restores focus to the trigger element when closed', async () => {
    const triggerButton = document.createElement('button');
    triggerButton.type = 'button';
    triggerButton.textContent = 'Open confirmation';
    document.body.appendChild(triggerButton);
    triggerButton.focus();

    render(ConfirmDialog);
    const { confirmationPromise } = await openDialog();

    uiStore.resolveConfirmation(false);
    await confirmationPromise;

    await waitFor(() => {
      expect(triggerButton).toHaveFocus();
    });
  });

  it('closes on Escape and resolves the confirmation as false', async () => {
    render(ConfirmDialog);
    const { confirmationPromise, dialog } = await openDialog();

    await fireEvent.keyDown(dialog, { key: 'Escape' });

    await expect(confirmationPromise).resolves.toBe(false);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
