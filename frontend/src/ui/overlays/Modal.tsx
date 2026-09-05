import { useCallback, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../cn';
import { useFocusTrap } from '../hooks';
import { Button } from '../primitives/Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClass = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const handleClose = useCallback(() => onClose(), [onClose]);
  useFocusTrap(open, panelRef, handleClose);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-slate-950/50" data-testid="modal-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full rounded-t-2xl border border-edge bg-surface-elevated p-5 shadow-panel sm:rounded-2xl',
          sizeClass[size],
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="h-8 w-8 p-0">
            ×
          </Button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
