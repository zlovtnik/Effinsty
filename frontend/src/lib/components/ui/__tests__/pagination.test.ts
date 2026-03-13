// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Pagination from '../Pagination.svelte';

describe('Pagination', () => {
  it('renders summary and navigates with callbacks', async () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(Pagination, {
      props: {
        page: 2,
        pageSize: 20,
        totalCount: 55,
        onPageChange,
        onPageSizeChange,
      },
    });

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const previous = screen.getByRole('button', { name: 'Go to previous page, page 1' });
    const next = screen.getByRole('button', { name: 'Go to next page, page 3' });
    const size = screen.getByLabelText('Page size');

    expect(previous).not.toBeDisabled();
    expect(next).not.toBeDisabled();

    await fireEvent.click(previous);
    expect(onPageChange).toHaveBeenCalledWith(1);
    await fireEvent.click(next);
    expect(onPageChange).toHaveBeenCalledWith(3);
    await fireEvent.change(size, { target: { value: '50' } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('disables actions when at boundaries', () => {
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();

    render(Pagination, {
      props: {
        page: 1,
        pageSize: 20,
        totalCount: 10,
        onPageChange,
        onPageSizeChange,
      },
    });

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});
