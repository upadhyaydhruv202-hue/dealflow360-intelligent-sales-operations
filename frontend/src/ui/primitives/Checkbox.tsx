import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';
import { useStableId } from '../hooks';
import { errorClass, focusRing, helpClass } from '../styles';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { id, label, hint, error, className, ...props },
  ref,
) {
  const inputId = useStableId('checkbox', id);

  return (
    <div>
      <label className="inline-flex items-start gap-2 text-sm text-foreground" htmlFor={inputId}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            'mt-0.5 h-4 w-4 rounded border-edge text-accent accent-accent',
            focusRing,
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        <span>
          {label}
          {hint ? <span className={cn(helpClass, 'mt-0 block')}>{hint}</span> : null}
        </span>
      </label>
      {error ? (
        <p className={errorClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
