import { useMemo, useState, type ReactNode } from 'react';

import { cn } from '../cn';
import { Skeleton } from '../primitives/Skeleton';
import { EmptyState } from '../states/FeedbackStates';

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
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState(sort);
  const activeSort = onSortChange ? sort : internalSort;

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
    <div className="overflow-x-auto rounded-xl border border-edge">
      <table className="min-w-full text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-foreground-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.id} scope="col" className={cn('px-4 py-3 font-semibold', column.className)}>
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
          {sortedRows.map((row) => (
            <tr
              key={rowId(row)}
              className={cn('border-t border-edge', onRowClick && 'cursor-pointer hover:bg-surface-muted')}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td key={column.id} className={cn('px-4 py-3 text-foreground', column.className)}>
                  {cellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
