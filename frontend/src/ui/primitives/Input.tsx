import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';
import { useStableId } from '../hooks';
import { controlBase, errorClass, helpClass, labelClass } from '../styles';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, className, disabled, ...props },
  ref,
) {
  const inputId = useStableId('input', id);
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label ? (
        <label className={cn(labelClass, 'mb-1')} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(controlBase, error ? 'border-danger' : undefined, className)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
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
