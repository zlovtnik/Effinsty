// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ModalHarness from './fixtures/ModalHarness.svelte';

describe('Modal', () => {
  it('closes from Escape', async () => {
    const onClose = vi.fn();

    render(ModalHarness, {
      props: {
        isOpen: true,
        onClose,
      },
    });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('contains labelled actions and can cycle focus with Tab', async () => {
    const onClose = vi.fn();

    render(ModalHarness, {
      props: {
        isOpen: true,
        onClose,
      },
    });

    const primary = screen.getByRole('button', { name: 'Primary action' });
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    const dialog = screen.getByRole('dialog');

    const pressTab = (shift = false): void => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true,
        shiftKey: shift,
      });
      dialog.dispatchEvent(event);
    };

    // Initial focus is pushed to the content action.
    await waitFor(() => {
      expect(primary).toHaveFocus();
    });

    pressTab();
    await waitFor(() => {
      expect(cancel).toHaveFocus();
    });

    pressTab();
    await waitFor(() => {
      expect(confirm).toHaveFocus();
    });

    pressTab();
    await waitFor(() => {
      expect(close).toHaveFocus();
    });
  });
});
