import type { ReactNode } from 'react';

import { cn } from '../cn';
import { Button } from '../primitives/Button';
import { Card, CardActions, CardHeader, CardTitle } from '../primitives/Card';

export interface FilterPanelProps {
  title?: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onApply?: () => void;
  onReset?: () => void;
  appliedCount?: number;
  className?: string;
}

export function FilterPanel({
  title = 'Filters',
  children,
  open = true,
  onOpenChange,
  onApply,
  onReset,
  appliedCount,
  className,
}: FilterPanelProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle>
          {title}
          {appliedCount ? (
            <span className="ml-2 text-xs font-normal text-foreground-muted">{appliedCount} applied</span>
          ) : null}
        </CardTitle>
        <CardActions>
          {onOpenChange ? (
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(!open)} aria-expanded={open}>
              {open ? 'Hide' : 'Show'}
            </Button>
          ) : null}
        </CardActions>
      </CardHeader>
      {open ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{children}</div>
          {onApply || onReset ? (
            <div className="flex justify-end gap-2">
              {onReset ? (
                <Button variant="outline" size="sm" onClick={onReset}>
                  Reset
                </Button>
              ) : null}
              {onApply ? (
                <Button size="sm" onClick={onApply}>
                  Apply
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
