import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { Select } from '../primitives/Select';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-xs text-foreground-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <Select
            aria-label="Rows per page"
            value={String(pageSize)}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            options={pageSizeOptions.map((size) => ({ value: String(size), label: `${size} / page` }))}
            className="w-32"
          />
        ) : null}
        <Button variant="outline" size="sm" onClick={() => onPageChange(1)} disabled={safePage <= 1}>
          First
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
        >
          Previous
        </Button>
        <span className="text-xs text-foreground-muted">
          Page {safePage} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
        >
          Next
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pageCount)}
          disabled={safePage >= pageCount}
        >
          Last
        </Button>
      </div>
    </div>
  );
}
