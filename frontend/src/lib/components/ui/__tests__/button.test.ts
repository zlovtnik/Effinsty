// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ButtonHarness from './fixtures/ButtonHarness.svelte';

describe('Button', () => {
  it('renders with accessible name and click behavior', async () => {
    const onClick = vi.fn();

    render(ButtonHarness, {
      props: {
        label: 'Save',
        onClick,
      },
    });

    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('keeps loading button disabled and aria-busy', () => {
    const onClick = vi.fn();

    render(ButtonHarness, {
      props: {
        label: 'Saving',
        onClick,
        loading: true,
      },
    });

    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });
});
