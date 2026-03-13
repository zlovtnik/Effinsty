// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Toast from '../Toast.svelte';

describe('Toast', () => {
  it('renders message content and dismissal control', async () => {
    const dismiss = vi.fn();

    render(Toast, {
      props: {
        id: 'toast-1',
        type: 'success',
        title: 'Saved',
        message: 'Contact created.',
        onDismiss: dismiss,
      },
    });

    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Contact created.')).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(dismiss).toHaveBeenCalledWith('toast-1');
  });
});
