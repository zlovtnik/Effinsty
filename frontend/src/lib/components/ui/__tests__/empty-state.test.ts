// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import EmptyState from '../EmptyState.svelte';

describe('EmptyState', () => {
  it('renders title, message, and CTA text', () => {
    render(EmptyState, {
      props: {
        title: 'No data',
        message: 'Try a different search.',
        ctaText: 'Create item',
      },
    });

    expect(screen.getByRole('heading', { name: 'No data' })).toHaveTextContent('No data');
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
    expect(screen.getByText('Create item')).toBeInTheDocument();
  });
});
