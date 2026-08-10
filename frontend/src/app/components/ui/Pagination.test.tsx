import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from './Pagination';

function renderPagination(overrides: Partial<React.ComponentProps<typeof Pagination>> = {}) {
  const onPageChange = vi.fn();
  const onPageSizeChange = vi.fn();
  render(
    <Pagination
      page={1}
      pageSize={10}
      totalItems={25}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      {...overrides}
    />,
  );
  return { onPageChange, onPageSizeChange };
}

describe('Pagination', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders one button per page', () => {
    renderPagination();

    ['1', '2', '3'].forEach((label) => {
      expect(screen.getByRole('button', { name: `${label}페이지` })).toBeInTheDocument();
    });
  });

  it('marks the current page so it stands out from the others', () => {
    renderPagination({ page: 2 });

    expect(screen.getByRole('button', { name: '2페이지' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '1페이지' })).not.toHaveAttribute('aria-current');
  });

  it('reports the page the user clicked', () => {
    const { onPageChange } = renderPagination();

    fireEvent.click(screen.getByRole('button', { name: '3페이지' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('moves one page at a time with the previous and next buttons', () => {
    const { onPageChange } = renderPagination({ page: 2 });

    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on the first page', () => {
    renderPagination({ page: 1 });

    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeEnabled();
  });

  it('disables next on the last page', () => {
    renderPagination({ page: 3 });

    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeEnabled();
  });

  it('collapses long page runs so the row stays on one line', () => {
    renderPagination({ totalItems: 200, pageSize: 10, page: 1 });

    expect(screen.getByRole('button', { name: '20페이지' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '10페이지' })).not.toBeInTheDocument();
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('reports the page size the user picked', async () => {
    const { onPageSizeChange } = renderPagination();

    fireEvent.click(screen.getByRole('combobox', { name: '페이지당 개수' }));
    fireEvent.click(await screen.findByRole('option', { name: '50개씩' }));

    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });

  it('shows which slice of the results is on screen', () => {
    renderPagination({ page: 2, pageSize: 10, totalItems: 25 });

    expect(screen.getByText('25건 중 11–20건')).toBeInTheDocument();
  });

  it('hides the page buttons when everything fits on one page', () => {
    renderPagination({ totalItems: 6, pageSize: 10 });

    expect(screen.queryByRole('button', { name: '1페이지' })).not.toBeInTheDocument();
    // 개수 선택은 남아야 한다 — 더 적게 보고 싶을 수 있다.
    expect(screen.getByRole('combobox', { name: '페이지당 개수' })).toBeInTheDocument();
  });
});
