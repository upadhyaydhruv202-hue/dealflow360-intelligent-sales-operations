import { cloneElement, isValidElement, useId, useState, type ReactElement, type ReactNode } from 'react';

import { cn } from '../cn';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const describedBy = open ? tooltipId : undefined;

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': describedBy,
      })
    : children;

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {trigger}
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs text-foreground-inverted shadow-panel"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
