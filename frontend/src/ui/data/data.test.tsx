import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTable } from './DataTable';
import { FilterPanel } from './FilterPanel';
import { Pagination } from './Pagination';
import { Search } from './Search';

afterEach(() => {
  cleanup();
});

describe('data displays', () => {
  it('sorts rows locally and shows an empty state', () => {
    const { rerender } = render(
      <DataTable
        columns={[
          { id: 'name', header: 'Name', accessor: 'name', sortable: true },
          { id: 'status', header: 'Status', accessor: 'status' },
        ]}
        rows={[
          { name: 'Bravo', status: 'open' },
          { name: 'Alpha', status: 'closed' },
        ]}
        rowId={(row) => row.name}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    const cells = screen.getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Alpha');

    rerender(
      <DataTable
        columns={[{ id: 'name', header: 'Name', accessor: 'name' }]}
        rows={[] as Array<{ name: string }>}
        rowId={(row) => row.name}
        emptyTitle="No rows"
      />,
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();
  });

  it('paginates and disables previous on the first page', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={10} total={25} onPageChange={onPageChange} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('pages long tables instead of rendering every row', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ name: `Row ${index + 1}` }));
    render(
      <DataTable
        columns={[{ id: 'name', header: 'Name', accessor: 'name' }]}
        rows={rows}
        rowId={(row) => row.name}
        pageSize={8}
      />,
    );

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 8')).toBeInTheDocument();
    expect(screen.queryByText('Row 9')).not.toBeInTheDocument();
    expect(screen.getByText('1–8 of 20')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Row 9')).toBeInTheDocument();
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
    expect(screen.getByText('9–16 of 20')).toBeInTheDocument();
  });

  it('submits search and filter actions', () => {
    const onSubmit = vi.fn();
    const onApply = vi.fn();
    const onReset = vi.fn();
    render(
      <>
        <Search value="alpha" onChange={() => undefined} onSubmitSearch={onSubmit} />
        <FilterPanel onApply={onApply} onReset={onReset}>
          <p>Status filter</p>
        </FilterPanel>
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onSubmit).toHaveBeenCalledWith('alpha');
    expect(onApply).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
  });
});
