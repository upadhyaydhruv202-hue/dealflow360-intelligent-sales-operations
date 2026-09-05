import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';

import { cn } from '../cn';
import { useStableId } from '../hooks';
import { controlBase, errorClass, helpClass, labelClass } from '../styles';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, hint, error, options, placeholder, className, children, ...props },
  ref,
) {
  const selectId = useStableId('select', id);
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label ? (
        <label className={cn(labelClass, 'mb-1')} htmlFor={selectId}>
          {label}
        </label>
      ) : null}
      <select
        ref={ref}
        id={selectId}
        className={cn(controlBase, 'pr-8', error ? 'border-danger' : undefined, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled={props.required}>
            {placeholder}
          </option>
        ) : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {hint && !error ? (
        <p id={hintId} className={helpClass}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={errorClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
