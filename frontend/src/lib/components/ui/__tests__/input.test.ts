// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Input from '../Input.svelte';

describe('Input', () => {
  it('forwards error and described-by accessibility metadata', () => {
    render(Input, {
      props: {
        id: 'email',
        name: 'email',
        value: 'ada@example.com',
        error: true,
        describedBy: 'email-hint email-error',
      },
    });

    const input = screen.getByDisplayValue('ada@example.com');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-hint email-error');
    expect(input).toHaveClass('is-error');
  });

  it('renders disabled and readonly states directly on the control', () => {
    render(Input, {
      props: {
        id: 'username',
        name: 'username',
        value: 'readonly-user',
        disabled: true,
        readonly: true,
      },
    });

    const input = screen.getByDisplayValue('readonly-user');
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('readonly');
  });
});
