import { useCallback, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '../cn';
import { useFocusTrap } from '../hooks';
import { Button } from '../primitives/Button';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: 'left' | 'right';
}

export function Drawer({ open, onClose, title, children, footer, side = 'right' }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const handleClose = useCallback(() => onClose(), [onClose]);
  useFocusTrap(open, panelRef, handleClose);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/50" data-testid="drawer-backdrop" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'absolute top-0 flex h-full w-full max-w-md flex-col border-edge bg-surface-elevated shadow-panel',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
        )}
      >
        <div className="flex items-center justify-between border-b border-edge px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Close" onClick={onClose} className="h-8 w-8 p-0">
            ×
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <div className="border-t border-edge p-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
