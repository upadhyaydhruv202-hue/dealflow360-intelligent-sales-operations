import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { cn } from '../cn';
import { Skeleton } from '../primitives/Skeleton';
import { EmptyState } from '../states/FeedbackStates';
import { Pagination } from './Pagination';

export type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  accessor?: keyof T | ((row: T) => ReactNode);
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowId: (row: T) => string;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  sort?: { id: string; direction: SortDirection };
  onSortChange?: (sort: { id: string; direction: SortDirection }) => void;
  onRowClick?: (row: T) => void;
  caption?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
}

function cellValue<T>(row: T, column: DataTableColumn<T>): ReactNode {
  if (typeof column.accessor === 'function') {
    return column.accessor(row);
  }
  if (column.accessor) {
    return String(row[column.accessor] ?? '');
  }
  return null;
}

export function DataTable<T>({
  columns,
  rows,
  rowId,
  loading = false,
  emptyTitle = 'No rows',
  emptyDescription = 'There is nothing to show yet.',
  sort,
  onSortChange,
  onRowClick,
  caption,
  pageSize = 8,
  pageSizeOptions = [8, 16, 32],
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState(sort);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const activeSort = onSortChange ? sort : internalSort;
  const paginate = pageSize > 0;

  const sortedRows = useMemo(() => {
    if (onSortChange || !activeSort) {
      return rows;
    }
    const column = columns.find((item) => item.id === activeSort.id);
    if (!column || typeof column.accessor === 'function' || !column.accessor) {
      return rows;
    }
    const key = column.accessor;
    return [...rows].sort((left, right) => {
      const a = String(left[key] ?? '');
      const b = String(right[key] ?? '');
      return activeSort.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    });
  }, [activeSort, columns, onSortChange, rows]);

  const rowSignature = useMemo(
    () => `${sortedRows.length}:${sortedRows[0] ? rowId(sortedRows[0]) : ''}:${sortedRows.at(-1) ? rowId(sortedRows.at(-1)!) : ''}`,
    [rowId, sortedRows],
  );

  useEffect(() => {
    setPage(1);
  }, [rowSignature, rowsPerPage]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / Math.max(rowsPerPage, 1)));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const pagedRows = paginate
    ? sortedRows.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage)
    : sortedRows;

  function toggleSort(column: DataTableColumn<T>) {
    if (!column.sortable) {
      return;
    }
    const direction: SortDirection =
      activeSort?.id === column.id && activeSort.direction === 'asc' ? 'desc' : 'asc';
    const next = { id: column.id, direction };
    if (onSortChange) {
      onSortChange(next);
    } else {
      setInternalSort(next);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2" role="status" aria-label="Loading table">
        <Skeleton className="h-10" />
        <Skeleton lines={4} className="h-8" />
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 z-10 bg-surface-elevated text-caption font-medium uppercase tracking-[0.12em] text-foreground-muted">
          <tr className="border-b border-edge">
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn('px-3 py-2 font-medium', column.className)}>
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort(column)}
                    aria-sort={
                      activeSort?.id === column.id
                        ? activeSort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    {column.header}
                    {activeSort?.id === column.id ? (activeSort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pagedRows.map((row) => (
            <tr
              key={rowId(row)}
              className={cn(
                'border-b border-edge/80 last:border-0',
                onRowClick && 'cursor-pointer transition-colors duration-df hover:bg-surface-muted/80',
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.id} className={cn('px-3 py-2 text-foreground', column.className)}>
                  {cellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {paginate && sortedRows.length > pageSize ? (
        <div className="mt-3 border-t border-edge/80 pt-3">
          <Pagination
            page={safePage}
            pageSize={rowsPerPage}
            total={sortedRows.length}
            onPageChange={setPage}
            onPageSizeChange={setRowsPerPage}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      ) : null}
    </div>
  );
}
