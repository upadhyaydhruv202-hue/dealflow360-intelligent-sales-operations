import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';
import { focusRing } from '../styles';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-foreground text-foreground-inverted hover:opacity-90',
  secondary: 'bg-surface-muted text-foreground hover:bg-edge',
  outline: 'border border-edge bg-surface-elevated text-foreground hover:bg-surface-muted',
  ghost: 'text-foreground hover:bg-surface-muted',
  danger: 'bg-danger text-danger-foreground hover:opacity-90',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-xs',
  md: 'h-10 gap-2 px-3.5 text-sm',
  lg: 'h-11 gap-2 px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    type = 'button',
    leftIcon,
    rightIcon,
    children,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-control font-medium transition-all duration-df disabled:pointer-events-none disabled:opacity-50',
        focusRing,
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        leftIcon
      )}
      {children}
      {loading ? null : rightIcon}
    </button>
  );
});
