// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Skeleton from '../Skeleton.svelte';

describe('Skeleton', () => {
  it('renders requested line count', () => {
    render(Skeleton, { props: { lines: 3 } });

    expect(screen.getAllByTestId('ui-skeleton').length).toBe(1);
    expect(screen.getByTestId('ui-skeleton').querySelectorAll('span').length).toBe(3);
  });
});
