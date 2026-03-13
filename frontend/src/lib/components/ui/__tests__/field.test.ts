// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import FieldHarness from './fixtures/FieldHarness.svelte';

describe('Field', () => {
  it('associates label with control and forwards accessibility metadata', () => {
    render(FieldHarness, {
      props: {
        label: 'Email',
        required: true,
        hint: 'Use your work email',
      },
    });

    expect(screen.getByRole('textbox', { name: /Email/ })).toBeInTheDocument();
    expect(screen.getByText('Use your work email')).toBeInTheDocument();
  });

  it('renders field-level errors in alert region', () => {
    render(FieldHarness, {
      props: {
        label: 'Email',
        error: 'Email is required.',
      },
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Email is required.');
  });
});
